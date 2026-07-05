import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";
import {
  computeGlobalGenreChartData,
  type GlobalGenreChartPayload,
} from "@/lib/global-genre-chart";
import { GLOBAL_GENRE_CHARTS } from "@/lib/global-genre-charts";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";

function asPayload(row: {
  weeklySongs: unknown;
  weeklyArtists: unknown;
  overallSongs: unknown;
  overallArtists: unknown;
  contributorCount: number;
}): GlobalGenreChartPayload {
  return {
    weeklySongs: row.weeklySongs as GlobalSnapshotPayload["weeklySongs"],
    weeklyArtists: row.weeklyArtists as GlobalSnapshotPayload["weeklyArtists"],
    overallSongs: row.overallSongs as GlobalSnapshotPayload["overallSongs"],
    overallArtists: row.overallArtists as GlobalSnapshotPayload["overallArtists"],
    contributorCount: row.contributorCount,
  };
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

export async function saveGlobalGenreSnapshotForWeek(weekIndex: number, genreSlug: string) {
  const payload = await computeGlobalGenreChartData(weekIndex, genreSlug);
  const { weekLabel, dateRange } = await resolveWeekMeta(weekIndex);
  const data = {
    weekLabel,
    dateRange,
    weeklySongs: payload.weeklySongs as unknown as object,
    weeklyArtists: payload.weeklyArtists as unknown as object,
    overallSongs: payload.overallSongs as unknown as object,
    overallArtists: payload.overallArtists as unknown as object,
    contributorCount: payload.contributorCount,
    frozenAt: new Date(),
  };

  const saved = await prisma.globalGenreSnapshot.upsert({
    where: { weekIndex_genreSlug: { weekIndex, genreSlug } },
    update: data,
    create: { weekIndex, genreSlug, ...data },
  });

  return {
    weekIndex,
    genreSlug,
    weekLabel: saved.weekLabel,
    dateRange: saved.dateRange,
    payload: asPayload(saved),
  };
}

/** Congela todas as paradas por gênero da semana de ranking corrente (rodar na terça). */
export async function publishGlobalGenreSnapshotsForRankingWeek(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);
  const results: Array<{ genreSlug: string; created: boolean }> = [];

  for (const chart of GLOBAL_GENRE_CHARTS) {
    const existing = await prisma.globalGenreSnapshot.findUnique({
      where: { weekIndex_genreSlug: { weekIndex: rankingWeek.weekIndex, genreSlug: chart.slug } },
    });
    if (existing) {
      results.push({ genreSlug: chart.slug, created: false });
      continue;
    }
    await saveGlobalGenreSnapshotForWeek(rankingWeek.weekIndex, chart.slug);
    results.push({ genreSlug: chart.slug, created: true });
  }

  return { weekIndex: rankingWeek.weekIndex, weekLabel: rankingWeek.weekLabel, genres: results };
}

export async function loadGlobalGenreSnapshot(weekIndex: number, genreSlug: string) {
  const row = await prisma.globalGenreSnapshot.findUnique({
    where: { weekIndex_genreSlug: { weekIndex, genreSlug } },
  });
  if (!row) return null;
  return {
    weekIndex: row.weekIndex,
    genreSlug: row.genreSlug,
    weekLabel: row.weekLabel,
    dateRange: row.dateRange,
    payload: asPayload(row),
    frozenAt: row.frozenAt,
  };
}

export async function listGlobalGenreWeekIndexes(genreSlug: string): Promise<number[]> {
  const rows = await prisma.globalGenreSnapshot.findMany({
    where: { genreSlug },
    select: { weekIndex: true },
    orderBy: { weekIndex: "desc" },
  });
  return rows.map((row) => row.weekIndex);
}
