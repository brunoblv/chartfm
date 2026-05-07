import { prisma } from "@/lib/prisma";
import { buildWeekIndexFromDate, getPreviousClosedWeekDate, getRankingWeekReference } from "@/lib/chart-week";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";

export type GlobalSnapshotPayload = {
  weeklySongs: ReturnType<typeof aggregateGlobalSongs>;
  weeklyArtists: ReturnType<typeof aggregateTopArtists>;
  overallSongs: ReturnType<typeof aggregateGlobalSongs>;
  overallArtists: ReturnType<typeof aggregateTopArtists>;
};

function asPayload(snapshot: {
  weeklySongs: unknown;
  weeklyArtists: unknown;
  overallSongs: unknown;
  overallArtists: unknown;
}): GlobalSnapshotPayload {
  return {
    weeklySongs: snapshot.weeklySongs as GlobalSnapshotPayload["weeklySongs"],
    weeklyArtists: snapshot.weeklyArtists as GlobalSnapshotPayload["weeklyArtists"],
    overallSongs: snapshot.overallSongs as GlobalSnapshotPayload["overallSongs"],
    overallArtists: snapshot.overallArtists as GlobalSnapshotPayload["overallArtists"],
  };
}

async function loadWeeklyGlobalEntries(weekIdx: number): Promise<WeeklyChartEntryRow[]> {
  return prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx }, position: { lte: 100 } },
    select: {
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
          artistRef: { select: { id: true, spotifyId: true, name: true } },
          feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
        },
      },
    },
  });
}

async function loadHistoricalSongStats(upToWeekIdx: number): Promise<Map<string, { peak: number; weeks: number }>> {
  const rows = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: { lte: upToWeekIdx } }, position: { lte: 100 } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { spotifyId: true, title: true, artist: true } },
    },
  });

  // Agrupa pontos por semana → música para calcular rank global por semana
  const weekSongPoints = new Map<number, Map<string, number>>();
  for (const r of rows) {
    const key = r.song.spotifyId
      ? `song_spotify:${r.song.spotifyId}`
      : `song_local:${r.song.title.trim().replace(/\s+/g, " ").toLowerCase()}|${r.song.artist
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase()}`;
    const weekMap = weekSongPoints.get(r.chart.weekIndex) ?? new Map<string, number>();
    const pts = r.points > 0 ? r.points : 101 - r.position;
    weekMap.set(key, (weekMap.get(key) ?? 0) + pts);
    weekSongPoints.set(r.chart.weekIndex, weekMap);
  }

  // Para cada semana, ranqueia músicas e conta apenas as top 100
  const stats = new Map<string, { peak: number; weeks: number }>();
  for (const [, songMap] of weekSongPoints) {
    const sorted = [...songMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    for (let i = 0; i < sorted.length; i++) {
      const [key] = sorted[i];
      const globalPos = i + 1;
      const cur = stats.get(key) ?? { peak: globalPos, weeks: 0 };
      cur.peak = Math.min(cur.peak, globalPos);
      cur.weeks += 1;
      stats.set(key, cur);
    }
  }

  return stats;
}

async function loadHistoricalArtistStats(upToWeekIdx: number): Promise<Map<string, { peak: number; weeks: number }>> {
  const rows = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: { lte: upToWeekIdx } }, position: { lte: 100 } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: {
        select: {
          artist: true,
          artistSpotifyId: true,
          artistRef: { select: { spotifyId: true } },
          feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
        },
      },
    },
  });

  const weekArtistPoints = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const contributors = [
      {
        sid: r.song.artistRef?.spotifyId ?? r.song.artistSpotifyId ?? null,
        name: r.song.artist,
      },
      ...(r.song.feats ?? []).map((f) => ({
        sid: f.artist.spotifyId,
        name: f.artist.name,
      })),
    ];
    const seen = new Set<string>();
    const pts = r.points > 0 ? r.points : 101 - r.position;
    for (const contributor of contributors) {
      const key = contributor.sid
        ? `artist_spotify:${contributor.sid}`
        : `artist_name:${contributor.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const weekMap = weekArtistPoints.get(key) ?? new Map<number, number>();
      weekMap.set(r.chart.weekIndex, (weekMap.get(r.chart.weekIndex) ?? 0) + pts);
      weekArtistPoints.set(key, weekMap);
    }
  }

  const stats = new Map<string, { peak: number; weeks: number }>();
  const weeklyRanks = new Map<number, { key: string; pts: number }[]>();
  for (const [artistKey, wkMap] of weekArtistPoints) {
    for (const [wk, pts] of wkMap) {
      const arr = weeklyRanks.get(wk) ?? [];
      arr.push({ key: artistKey, pts });
      weeklyRanks.set(wk, arr);
    }
  }
  for (const [, arr] of weeklyRanks) {
    const sorted = arr.sort((a, b) => b.pts - a.pts);
    for (let i = 0; i < Math.min(sorted.length, 100); i++) {
      const a = sorted[i];
      const cur = stats.get(a.key) ?? { peak: i + 1, weeks: 0 };
      cur.peak = Math.min(cur.peak, i + 1);
      cur.weeks += 1;
      stats.set(a.key, cur);
    }
  }

  return stats;
}

export async function computeGlobalSnapshotData(weekIdx: number): Promise<GlobalSnapshotPayload> {
  const prevWeekIdx = buildWeekIndexFromDate(
    new Date(getPreviousClosedWeekDate(new Date()).getTime() - 7 * 24 * 60 * 60 * 1000)
  );

  const [weeklyEntries, prevWeekEntries, historicalSongStats, historicalArtistStats] = await Promise.all([
    loadWeeklyGlobalEntries(weekIdx),
    loadWeeklyGlobalEntries(prevWeekIdx),
    loadHistoricalSongStats(weekIdx),
    loadHistoricalArtistStats(weekIdx),
  ]);
  const [overallEntries, prevOverallEntries] = await Promise.all([
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: { lte: weekIdx } }, position: { lte: 100 } },
      select: {
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
            artistRef: { select: { id: true, spotifyId: true, name: true } },
            feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
          },
        },
      },
    }),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: { lte: prevWeekIdx } }, position: { lte: 100 } },
      select: {
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
            artistRef: { select: { id: true, spotifyId: true, name: true } },
            feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  return {
    weeklySongs: aggregateGlobalSongs(weeklyEntries, 100, {
      previousWeekEntries: prevWeekEntries,
      historicalStatsBySongKey: historicalSongStats,
      comparisonEntries: prevWeekEntries,
    }),
    weeklyArtists: aggregateTopArtists(weeklyEntries, 100, {
      previousWeekEntries: prevWeekEntries,
      historicalStatsByArtistKey: historicalArtistStats,
      comparisonEntries: prevWeekEntries,
    }),
    overallSongs: aggregateGlobalSongs(overallEntries, 100, {
      previousWeekEntries: prevOverallEntries,
      historicalStatsBySongKey: historicalSongStats,
      comparisonEntries: prevOverallEntries,
    }),
    overallArtists: aggregateTopArtists(overallEntries, 100, {
      previousWeekEntries: prevOverallEntries,
      historicalStatsByArtistKey: historicalArtistStats,
      comparisonEntries: prevOverallEntries,
    }),
  };
}

export async function getOrCreateRankingWeekSnapshot(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);
  const existing = await prisma.globalSnapshot.findUnique({
    where: { weekIndex: rankingWeek.weekIndex },
  });
  if (existing) {
    return {
      weekIndex: rankingWeek.weekIndex,
      weekLabel: rankingWeek.weekLabel,
      dateRange: rankingWeek.dateRange,
      payload: asPayload(existing),
      created: false,
    };
  }

  const payload = await computeGlobalSnapshotData(rankingWeek.weekIndex);
  const created = await prisma.globalSnapshot.create({
    data: {
      weekIndex: rankingWeek.weekIndex,
      weekLabel: rankingWeek.weekLabel,
      dateRange: rankingWeek.dateRange,
      weeklySongs: payload.weeklySongs as unknown as object,
      weeklyArtists: payload.weeklyArtists as unknown as object,
      overallSongs: payload.overallSongs as unknown as object,
      overallArtists: payload.overallArtists as unknown as object,
    },
  });
  return {
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
    payload: asPayload(created),
    created: true,
  };
}
