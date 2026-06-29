import { prisma } from "@/lib/prisma";
import { getGlobalSnapshotDeadline } from "@/lib/chart-week";
import {
  GLOBAL_RANKING_FIRST_WEEK_INDEX,
  globalPrevWeekIndex,
  isGlobalRankingWeek,
} from "@/lib/global-ranking-config";
import { effectiveSongGenreTags } from "@/lib/genre-taxonomy";
import {
  getGlobalGenreChart,
  GLOBAL_GENRE_CHART_LIMIT,
  matchesGlobalGenreChart,
} from "@/lib/global-genre-charts";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { songSnapshotAggKey } from "@/lib/global-snapshot";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";

function chartFilterWithDeadline(publishedBefore: Date) {
  return { parada: { isPrimary: true }, publishedAt: { lt: publishedBefore } };
}

const genreChartEntrySelect = {
  position: true,
  points: true,
  chartId: true,
  coverPaletteA: true,
  coverPaletteB: true,
  coverSeed: true,
  song: {
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      albumRef: { select: { id: true, coverUrl: true } },
      spotifyId: true,
      artistSpotifyId: true,
      genres: true,
      artistRef: { select: { id: true, spotifyId: true, name: true, genres: true } },
      feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
    },
  },
} as const;

type RawEntry = WeeklyChartEntryRow & {
  song: WeeklyChartEntryRow["song"] & {
    genres: string[];
    artistRef: { id: number; spotifyId: string; name: string; genres: string[] } | null;
  };
};

async function loadWeeklyEntries(weekIdx: number, publishedBefore: Date): Promise<RawEntry[]> {
  return prisma.chartEntry.findMany({
    where: {
      chart: { weekIndex: weekIdx, ...chartFilterWithDeadline(publishedBefore) },
      position: { lte: 100 },
    },
    select: genreChartEntrySelect,
  }) as Promise<RawEntry[]>;
}

function filterByGenre(entries: RawEntry[], genreSlug: string): WeeklyChartEntryRow[] {
  return entries.filter((e) => {
    const tags = effectiveSongGenreTags(e.song.genres, e.song.artistRef?.genres);
    return matchesGlobalGenreChart(tags, genreSlug);
  });
}

function buildSongPrevPositions(
  songs: ReturnType<typeof aggregateGlobalSongs>,
): Map<string, number> {
  return new Map(songs.map((s) => [songSnapshotAggKey(s.song), s.position] as [string, number]));
}

function buildArtistPrevPositions(
  artists: ReturnType<typeof aggregateTopArtists>,
): Map<string, number> {
  return new Map(
    artists.map((a) => {
      const key = a.spotifyId
        ? `artist_spotify:${a.spotifyId}`
        : `artist_name:${a.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
      return [key, a.position] as [string, number];
    }),
  );
}

export type GlobalGenreChartPayload = Pick<
  GlobalSnapshotPayload,
  "weeklySongs" | "weeklyArtists" | "overallSongs" | "overallArtists"
>;

export async function computeGlobalGenreChartData(
  weekIdx: number,
  genreSlug: string,
  options?: { skipDeadline?: boolean },
): Promise<GlobalGenreChartPayload> {
  if (!getGlobalGenreChart(genreSlug)) {
    throw new Error(`Parada global de gênero desconhecida: ${genreSlug}`);
  }
  if (!isGlobalRankingWeek(weekIdx)) {
    throw new Error(
      `Semana ${weekIdx} está antes do corte do ranking global (${GLOBAL_RANKING_FIRST_WEEK_INDEX}).`,
    );
  }

  const limit = GLOBAL_GENRE_CHART_LIMIT;
  const prevWeekIdx = globalPrevWeekIndex(weekIdx);
  const FAR_FUTURE = new Date("2099-12-31T23:59:59Z");
  const deadline = options?.skipDeadline ? FAR_FUTURE : getGlobalSnapshotDeadline(weekIdx);
  const prevDeadline = prevWeekIdx
    ? (options?.skipDeadline ? FAR_FUTURE : getGlobalSnapshotDeadline(prevWeekIdx))
    : null;

  const [weeklyRaw, prevWeekRaw] = await Promise.all([
    loadWeeklyEntries(weekIdx, deadline),
    prevWeekIdx && prevDeadline ? loadWeeklyEntries(prevWeekIdx, prevDeadline) : Promise.resolve([]),
  ]);

  const weeklyEntries = filterByGenre(weeklyRaw, genreSlug);
  const prevWeekEntries = filterByGenre(prevWeekRaw, genreSlug);

  const [overallRaw, prevOverallRaw] = await Promise.all([
    prisma.chartEntry.findMany({
      where: {
        chart: {
          weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX, lte: weekIdx },
          ...chartFilterWithDeadline(deadline),
        },
        position: { lte: 100 },
      },
      select: genreChartEntrySelect,
    }) as Promise<RawEntry[]>,
    prevWeekIdx && prevDeadline
      ? (prisma.chartEntry.findMany({
          where: {
            chart: {
              weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX, lte: prevWeekIdx },
              ...chartFilterWithDeadline(prevDeadline),
            },
            position: { lte: 100 },
          },
          select: genreChartEntrySelect,
        }) as Promise<RawEntry[]>)
      : Promise.resolve([]),
  ]);

  const overallEntries = filterByGenre(overallRaw, genreSlug);
  const prevOverallEntries = filterByGenre(prevOverallRaw, genreSlug);

  const prevWeeklySongs = aggregateGlobalSongs(prevWeekEntries, limit, { weightMode: "stored" });
  const prevOverallSongs = aggregateGlobalSongs(prevOverallEntries, limit, { weightMode: "stored" });

  return {
    weeklySongs: aggregateGlobalSongs(weeklyEntries, limit, {
      previousWeekEntries: prevWeekEntries,
      comparisonEntries: prevWeekEntries,
      prevPositionsByKey: buildSongPrevPositions(prevWeeklySongs),
      weightMode: "stored",
    }),
    weeklyArtists: aggregateTopArtists(weeklyEntries, limit, {
      previousWeekEntries: prevWeekEntries,
      comparisonEntries: prevWeekEntries,
      prevPositionsByKey: buildArtistPrevPositions(
        aggregateTopArtists(prevWeekEntries, limit, { weightMode: "stored" }),
      ),
      weightMode: "stored",
    }),
    overallSongs: aggregateGlobalSongs(overallEntries, limit, {
      previousWeekEntries: prevOverallEntries,
      comparisonEntries: prevOverallEntries,
      prevPositionsByKey: buildSongPrevPositions(prevOverallSongs),
      weightMode: "stored",
    }),
    overallArtists: aggregateTopArtists(overallEntries, limit, {
      previousWeekEntries: prevOverallEntries,
      comparisonEntries: prevOverallEntries,
      prevPositionsByKey: buildArtistPrevPositions(
        aggregateTopArtists(prevOverallEntries, limit, { weightMode: "stored" }),
      ),
      weightMode: "stored",
    }),
  };
}
