import { prisma } from "@/lib/prisma";
import { getGlobalSnapshotDeadline, getRankingWeekReference } from "@/lib/chart-week";
import {
  GLOBAL_RANKING_FIRST_WEEK_INDEX,
  globalPrevWeekIndex,
  isGlobalRankingWeek,
} from "@/lib/global-ranking-config";

export const CURATOR_SCORE_CHART = 100;
export const CURATOR_SCORE_LIKE = 5;
export const CURATOR_SCORE_COMMENT = 25;
export const CURATORS_RANKING_LIMIT = 20;

export type CuratorRankingEntry = {
  position: number;
  userId: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
  bio: string | null;
  chartId: string;
  chartCount: number;
  likesGiven: number;
  commentsWritten: number;
  score: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  numberOnes: number;
};

type CuratorHistoricalStat = { peak: number; weeks: number; numberOnes: number };

export function computeCuratorScore(chartCount: number, likesGiven: number, commentsWritten: number): number {
  return chartCount * CURATOR_SCORE_CHART + likesGiven * CURATOR_SCORE_LIKE + commentsWritten * CURATOR_SCORE_COMMENT;
}

function chartPublishedBeforeFilter(publishedBefore: Date) {
  return { isPublished: true as const, publishedAt: { lt: publishedBefore } };
}

async function loadCuratorScoresForWeek(weekIndex: number, publishedBefore: Date) {
  const weekChartFilter = { weekIndex, ...chartPublishedBeforeFilter(publishedBefore) };

  const primaryCharts = await prisma.chart.findMany({
    where: { ...weekChartFilter, parada: { isPrimary: true } },
    orderBy: [{ publishedAt: "asc" }],
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          bio: true,
        },
      },
    },
  });

  const [likesGivenRows, commentsWrittenRows] = await Promise.all([
    prisma.chartLike.groupBy({
      by: ["userId"],
      where: { chart: weekChartFilter },
      _count: { _all: true },
    }),
    prisma.comment.groupBy({
      by: ["userId"],
      where: { chart: weekChartFilter },
      _count: { _all: true },
    }),
  ]);

  const primaryByUser = new Map(primaryCharts.map((chart) => [chart.userId, chart]));
  const likesGivenByUser = new Map(likesGivenRows.map((r) => [r.userId, r._count._all]));
  const commentsWrittenByUser = new Map(commentsWrittenRows.map((r) => [r.userId, r._count._all]));

  const allUserIds = [
    ...new Set([
      ...primaryCharts.map((c) => c.userId),
      ...likesGivenRows.map((r) => r.userId),
      ...commentsWrittenRows.map((r) => r.userId),
    ]),
  ];

  const usersWithoutPrimaryChart = allUserIds.filter((userId) => !primaryByUser.has(userId));
  const extraUsers = usersWithoutPrimaryChart.length
    ? await prisma.user.findMany({
        where: { id: { in: usersWithoutPrimaryChart } },
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          bio: true,
        },
      })
    : [];

  const userById = new Map([
    ...primaryCharts.map((chart) => [chart.userId, chart.user] as const),
    ...extraUsers.map((user) => [user.id, user] as const),
  ]);

  return allUserIds
    .map((userId) => {
      const primaryChart = primaryByUser.get(userId);
      const user = userById.get(userId);
      if (!user) return null;

      const chartCount = primaryChart ? 1 : 0;
      const likesGiven = likesGivenByUser.get(userId) ?? 0;
      const commentsWritten = commentsWrittenByUser.get(userId) ?? 0;

      return {
        userId: user.id,
        handle: user.handle,
        name: user.name,
        avatarColor: user.avatarColor,
        image: user.image,
        bio: user.bio,
        chartId: primaryChart?.id ?? "",
        chartCount,
        likesGiven,
        commentsWritten,
        score: computeCuratorScore(chartCount, likesGiven, commentsWritten),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.commentsWritten !== a.commentsWritten) return b.commentsWritten - a.commentsWritten;
      return b.likesGiven - a.likesGiven;
    })
    .slice(0, CURATORS_RANKING_LIMIT);
}

function accumulateCuratorHistoricalStats(
  snapshots: Array<{ entries: CuratorRankingEntry[] }>,
): Map<string, CuratorHistoricalStat> {
  const stats = new Map<string, CuratorHistoricalStat>();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.entries) {
      const cur = stats.get(entry.userId) ?? { peak: entry.position, weeks: 0, numberOnes: 0 };
      cur.peak = Math.min(cur.peak, entry.position);
      cur.weeks += 1;
      if (entry.position === 1) cur.numberOnes += 1;
      stats.set(entry.userId, cur);
    }
  }
  return stats;
}

function applyCuratorRankingStats(
  ranked: Awaited<ReturnType<typeof loadCuratorScoresForWeek>>,
  prevEntries: CuratorRankingEntry[],
  historicalByUser: Map<string, CuratorHistoricalStat>,
): CuratorRankingEntry[] {
  const prevPosByUser = new Map(prevEntries.map((entry) => [entry.userId, entry.position]));

  return ranked.map((row, index) => {
    const position = index + 1;
    const prevPos = prevPosByUser.get(row.userId) ?? null;
    const historical = historicalByUser.get(row.userId);
    const delta = prevPos !== null ? prevPos - position : null;
    const status: CuratorRankingEntry["status"] =
      prevPos !== null
        ? delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down"
        : historical
          ? "return"
          : "new";

    return {
      position,
      ...row,
      status,
      delta,
      prevPos,
      peak: Math.min(historical?.peak ?? position, position),
      weeks: (historical?.weeks ?? 0) + 1,
      numberOnes: (historical?.numberOnes ?? 0) + (position === 1 ? 1 : 0),
    };
  });
}

export async function computeCuratorsSnapshotData(weekIndex: number): Promise<CuratorRankingEntry[]> {
  const publishedBefore = getGlobalSnapshotDeadline(weekIndex);
  const ranked = await loadCuratorScoresForWeek(weekIndex, publishedBefore);

  const prevWeekIndex = globalPrevWeekIndex(weekIndex);
  const prevSnapshot = prevWeekIndex
    ? await prisma.curatorsSnapshot.findUnique({ where: { weekIndex: prevWeekIndex } })
    : null;
  const prevEntries = (prevSnapshot?.entries as CuratorRankingEntry[] | undefined) ?? [];

  const priorSnapshots = await prisma.curatorsSnapshot.findMany({
    where: {
      weekIndex: {
        lt: weekIndex,
        ...(isGlobalRankingWeek(weekIndex) ? { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX } : {}),
      },
    },
    select: { entries: true },
    orderBy: { weekIndex: "asc" },
  });
  const historicalByUser = accumulateCuratorHistoricalStats(
    priorSnapshots.map((snapshot) => ({ entries: snapshot.entries as CuratorRankingEntry[] })),
  );

  return applyCuratorRankingStats(ranked, prevEntries, historicalByUser);
}

async function resolveWeekMeta(weekIndex: number): Promise<{ weekLabel: string; dateRange: string }> {
  const chart = await prisma.chart.findFirst({
    where: { weekIndex, parada: { isPrimary: true } },
    select: { weekLabel: true, dateRange: true },
    orderBy: { publishedAt: "desc" },
  });
  if (chart?.weekLabel && chart?.dateRange) {
    return { weekLabel: chart.weekLabel, dateRange: chart.dateRange };
  }
  const year = Math.floor(weekIndex / 100);
  const week = weekIndex % 100;
  return {
    weekLabel: `Semana ${week} - ${year}`,
    dateRange: chart?.dateRange ?? "",
  };
}

export async function saveCuratorsSnapshotForWeek(weekIndex: number) {
  const { weekLabel, dateRange } = await resolveWeekMeta(weekIndex);
  const entries = await computeCuratorsSnapshotData(weekIndex);
  const saved = await prisma.curatorsSnapshot.upsert({
    where: { weekIndex },
    update: {
      weekLabel,
      dateRange,
      entries: entries as unknown as object,
      frozenAt: new Date(),
    },
    create: {
      weekIndex,
      weekLabel,
      dateRange,
      entries: entries as unknown as object,
    },
  });
  return {
    weekIndex,
    weekLabel: saved.weekLabel,
    dateRange: saved.dateRange,
    entries: saved.entries as CuratorRankingEntry[],
  };
}

export async function getOrCreateCuratorsSnapshot(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);
  const existing = await prisma.curatorsSnapshot.findUnique({
    where: { weekIndex: rankingWeek.weekIndex },
  });
  if (existing) {
    return {
      weekIndex: rankingWeek.weekIndex,
      weekLabel: existing.weekLabel,
      dateRange: existing.dateRange,
      entries: existing.entries as CuratorRankingEntry[],
      created: false,
    };
  }

  const saved = await saveCuratorsSnapshotForWeek(rankingWeek.weekIndex);
  return { ...saved, created: true };
}

export async function getLatestCuratorsSnapshot(maxWeekIndex?: number) {
  const weekIndex = maxWeekIndex ?? getRankingWeekReference(new Date()).weekIndex;
  const row = await prisma.curatorsSnapshot.findFirst({
    where: { weekIndex: { lte: weekIndex } },
    orderBy: { weekIndex: "desc" },
  });
  if (!row) return null;
  return {
    weekIndex: row.weekIndex,
    weekLabel: row.weekLabel,
    dateRange: row.dateRange,
    entries: row.entries as CuratorRankingEntry[],
  };
}
