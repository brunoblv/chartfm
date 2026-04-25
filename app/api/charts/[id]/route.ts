import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapPrismaChartDetail } from "@/lib/map-db-profile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const row = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          bio: true,
          followers: true,
          following: true,
          streak: true,
          verified: true,
          image: true,
        },
      },
      entries: {
        orderBy: { position: "asc" },
        include: { song: true },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const currentSongIds = [...new Set(row.entries.map((e) => e.songId))];
  const history = await prisma.chartEntry.findMany({
    where: {
      songId: { in: currentSongIds },
      chart: {
        userId: row.userId,
        weekIndex: { lte: row.weekIndex },
      },
    },
    select: {
      songId: true,
      position: true,
      chart: { select: { weekIndex: true } },
    },
  });

  const bySong = new Map<string, { weekIndex: number; position: number }[]>();
  for (const h of history) {
    const arr = bySong.get(h.songId) ?? [];
    arr.push({ weekIndex: h.chart.weekIndex, position: h.position });
    bySong.set(h.songId, arr);
  }

  const entriesWithComputedStats = row.entries.map((entry) => {
    const hist = bySong.get(entry.songId) ?? [];
    const weeks = hist.length;
    const peak = hist.length ? Math.min(...hist.map((h) => h.position)) : entry.position;
    const prev = hist
      .filter((h) => h.weekIndex < row.weekIndex)
      .sort((a, b) => b.weekIndex - a.weekIndex)[0];
    const prevPos = prev?.position ?? null;
    const delta = prevPos === null ? null : prevPos - entry.position;
    let status: "new" | "up" | "down" | "same" = "new";
    if (prevPos !== null) {
      if (delta === 0) status = "same";
      else if ((delta ?? 0) > 0) status = "up";
      else status = "down";
    }

    return {
      ...entry,
      status,
      delta,
      prevPos,
      peak,
      weeks,
    };
  });

  return NextResponse.json(
    mapPrismaChartDetail({
      ...row,
      entries: entriesWithComputedStats,
    })
  );
}
