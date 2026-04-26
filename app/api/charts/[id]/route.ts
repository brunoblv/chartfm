import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mapPrismaChartDetail } from "@/lib/map-db-profile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
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
        include: {
          song: {
            include: {
              artistRef: {
                select: { name: true },
              },
              feats: {
                include: {
                  artist: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const currentSongIds = [...new Set(row.entries.map((e) => e.songId))];
  const songIdToKey = new Map(row.entries.map((e) => [e.songId, `${e.song.title}\0${e.song.artist}`]));

  const [history, globalOnes] = await Promise.all([
    prisma.chartEntry.findMany({
      where: {
        songId: { in: currentSongIds },
        chart: { userId: row.userId, weekIndex: { lte: row.weekIndex } },
      },
      select: { songId: true, position: true, chart: { select: { weekIndex: true } } },
    }),
    prisma.chartEntry.findMany({
      where: { position: 1, songId: { in: currentSongIds } },
      select: { songId: true },
    }),
  ]);
  const [previousChart, nextChart] = await Promise.all([
    prisma.chart.findFirst({
      where: { userId: row.userId, weekIndex: { lt: row.weekIndex } },
      orderBy: { weekIndex: "desc" },
      select: { id: true, weekLabel: true },
    }),
    prisma.chart.findFirst({
      where: { userId: row.userId, weekIndex: { gt: row.weekIndex } },
      orderBy: { weekIndex: "asc" },
      select: { id: true, weekLabel: true },
    }),
  ]);

  const personalNumberOnes: Record<string, number> = {};
  for (const h of history) {
    if (h.position === 1) {
      const key = songIdToKey.get(h.songId);
      if (key) personalNumberOnes[key] = (personalNumberOnes[key] ?? 0) + 1;
    }
  }

  const globalNumberOnes: Record<string, number> = {};
  for (const g of globalOnes) {
    const key = songIdToKey.get(g.songId);
    if (key) globalNumberOnes[key] = (globalNumberOnes[key] ?? 0) + 1;
  }

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

  let liked = false;
  let reposted = false;
  if (session?.user?.id) {
    const [like, repost] = await Promise.all([
      prisma.chartLike.findUnique({
        where: { userId_chartId: { userId: session.user.id, chartId: row.id } },
        select: { id: true },
      }),
      prisma.chartRepost.findUnique({
        where: { userId_chartId: { userId: session.user.id, chartId: row.id } },
        select: { id: true },
      }),
    ]);
    liked = !!like;
    reposted = !!repost;
  }

  return NextResponse.json({
    ...mapPrismaChartDetail({ ...row, entries: entriesWithComputedStats }),
    previousChart,
    nextChart,
    personalNumberOnes,
    globalNumberOnes,
    liked,
    reposted,
  });
}
