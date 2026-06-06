import { prisma } from "@/lib/prisma";
import {
  buildWeeklyBucketsFromChartRows,
  currentWeekIdxBrt,
  deserializeWeeklyBuckets,
  serializeWeeklyBuckets,
  type WeeklyBucketsSerialized,
} from "@/lib/chart-page-common";
import { snapshotDayBrt } from "@/lib/snapshot-day";

export type DailyChartSongStatsData = {
  snapshotDay: Date;
  currentWeekIdx: number;
  weeklyBuckets: Map<number, Map<string, number>>;
  builtAt: Date;
};

export async function buildDailyChartSongStats(now: Date = new Date()): Promise<DailyChartSongStatsData> {
  const globalRows = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { title: true, artist: true } },
    },
  });

  return {
    snapshotDay: snapshotDayBrt(now),
    currentWeekIdx: currentWeekIdxBrt(now),
    weeklyBuckets: buildWeeklyBucketsFromChartRows(globalRows),
    builtAt: now,
  };
}

export async function saveDailyChartSongStats(data: DailyChartSongStatsData) {
  const weeklyBuckets = serializeWeeklyBuckets(data.weeklyBuckets);
  return prisma.dailyChartSongStats.upsert({
    where: { snapshotDay: data.snapshotDay },
    create: {
      snapshotDay: data.snapshotDay,
      currentWeekIdx: data.currentWeekIdx,
      weeklyBuckets,
      builtAt: data.builtAt,
    },
    update: {
      currentWeekIdx: data.currentWeekIdx,
      weeklyBuckets,
      builtAt: data.builtAt,
    },
  });
}

export async function buildAndSaveDailyChartSongStats(now: Date = new Date()) {
  const data = await buildDailyChartSongStats(now);
  await saveDailyChartSongStats(data);
  return data;
}

export async function getLatestDailyChartSongStats(): Promise<DailyChartSongStatsData | null> {
  const row = await prisma.dailyChartSongStats.findFirst({
    orderBy: { snapshotDay: "desc" },
  });
  if (!row) return null;
  return {
    snapshotDay: row.snapshotDay,
    currentWeekIdx: row.currentWeekIdx,
    weeklyBuckets: deserializeWeeklyBuckets(row.weeklyBuckets as WeeklyBucketsSerialized),
    builtAt: row.builtAt,
  };
}

/** Usado nas páginas: snapshot diário ou cálculo ao vivo (fallback). */
export async function getDailyChartSongStatsForPages(): Promise<DailyChartSongStatsData> {
  const cached = await getLatestDailyChartSongStats();
  if (cached) return cached;
  return buildDailyChartSongStats();
}
