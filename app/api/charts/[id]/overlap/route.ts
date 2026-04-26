import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type OverlapCandidate = {
  userId: string;
  chartId: string;
  songs: Set<string>;
};

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: chartId } = await context.params;

  const source = await prisma.chart.findUnique({
    where: { id: chartId },
    select: {
      id: true,
      userId: true,
      weekIndex: true,
      entries: { select: { songId: true } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sourceSongIds = new Set(source.entries.map((e) => e.songId));
  if (sourceSongIds.size === 0) {
    return NextResponse.json([]);
  }

  const sameWeekCharts = await prisma.chart.findMany({
    where: {
      weekIndex: source.weekIndex,
      userId: { not: source.userId },
      isPublished: true,
    },
    select: {
      id: true,
      userId: true,
      entries: { select: { songId: true } },
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
        },
      },
    },
  });

  const candidates: OverlapCandidate[] = sameWeekCharts.map((chart) => ({
    userId: chart.userId,
    chartId: chart.id,
    songs: new Set(chart.entries.map((e) => e.songId)),
  }));

  const ranked = candidates
    .map((c) => {
      let commonCount = 0;
      sourceSongIds.forEach((songId) => {
        if (c.songs.has(songId)) commonCount += 1;
      });
      const unionCount = sourceSongIds.size + c.songs.size - commonCount;
      const overlapPercent = unionCount > 0 ? Math.round((commonCount / unionCount) * 100) : 0;
      return { ...c, commonCount, unionCount, overlapPercent };
    })
    .filter((r) => r.commonCount > 0)
    .sort((a, b) => {
      if (b.overlapPercent !== a.overlapPercent) return b.overlapPercent - a.overlapPercent;
      return b.commonCount - a.commonCount;
    })
    .slice(0, 5);

  const byUserId = new Map(sameWeekCharts.map((c) => [c.userId, c.user]));
  const payload = ranked.map((r) => ({
    userId: r.userId,
    chartId: r.chartId,
    overlapPercent: r.overlapPercent,
    commonSongs: r.commonCount,
    totalSongs: r.unionCount,
    user: byUserId.get(r.userId),
  }));

  return NextResponse.json(payload);
}
