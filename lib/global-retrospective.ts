import { prisma } from "@/lib/prisma";
import { songSnapshotAggKey, type GlobalSnapshotPayload } from "@/lib/global-snapshot";
import type { Cover, Song } from "@/lib/types";

export type YearTopSongRow = {
  key: string;
  song: Song;
  cover: Cover;
  totalPoints: number;
  weeksOnChart: number;
  bestPosition: number;
};

export type YearTopArtistRow = {
  key: string;
  name: string;
  spotifyId: string | null;
  totalPoints: number;
  weeksOnChart: number;
  bestPosition: number;
};

export type YearRetrospective = {
  year: number;
  weekIndexes: number[];
  weeksCount: number;
  firstWeekLabel: string | null;
  lastWeekLabel: string | null;
  firstDateRange: string | null;
  lastDateRange: string | null;
  topSongs: YearTopSongRow[];
  topArtists: YearTopArtistRow[];
  distinctSongsCount: number;
  distinctArtistsCount: number;
  totalParadas: number;
};

function artistKeyFor(a: { spotifyId: string | null; name: string }): string {
  if (a.spotifyId) return `artist_spotify:${a.spotifyId}`;
  return `artist_name:${a.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/**
 * Agrega, por soma de pontos semana a semana, o ranking de músicas e artistas
 * de um ano civil a partir dos snapshots congelados do Global 100 (`GlobalSnapshot.weeklySongs`
 * / `weeklyArtists`). Cada semana já reflete a curva de pontos daquela parada global;
 * aqui apenas somamos essas semanas dentro do ano pedido.
 */
export async function loadYearRetrospective(year: number): Promise<YearRetrospective> {
  const gte = year * 100 + 1;
  const lte = year * 100 + 53; // maior semana ISO possível (53) — filtro seguro por ano civil

  const snapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { gte, lte } },
    select: { weekIndex: true, weekLabel: true, dateRange: true, weeklySongs: true, weeklyArtists: true },
    orderBy: { weekIndex: "asc" },
  });

  const songMap = new Map<string, YearTopSongRow>();
  const artistMap = new Map<string, YearTopArtistRow>();

  for (const snap of snapshots) {
    const songs = snap.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"];
    for (const s of songs) {
      const key = songSnapshotAggKey(s.song);
      const cur = songMap.get(key);
      if (!cur) {
        songMap.set(key, {
          key,
          song: s.song,
          cover: s.cover,
          totalPoints: s.points,
          weeksOnChart: 1,
          bestPosition: s.position,
        });
      } else {
        cur.totalPoints += s.points;
        cur.weeksOnChart += 1;
        cur.bestPosition = Math.min(cur.bestPosition, s.position);
      }
    }

    const artists = snap.weeklyArtists as unknown as GlobalSnapshotPayload["weeklyArtists"];
    for (const a of artists) {
      const key = artistKeyFor(a);
      const cur = artistMap.get(key);
      if (!cur) {
        artistMap.set(key, {
          key,
          name: a.name,
          spotifyId: a.spotifyId,
          totalPoints: a.totalPoints,
          weeksOnChart: 1,
          bestPosition: a.position,
        });
      } else {
        cur.totalPoints += a.totalPoints;
        cur.weeksOnChart += 1;
        cur.bestPosition = Math.min(cur.bestPosition, a.position);
      }
    }
  }

  const topSongs = [...songMap.values()].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 20);
  const topArtists = [...artistMap.values()].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);

  const totalParadas = await prisma.chart.count({ where: { weekIndex: { gte, lte } } });

  const first = snapshots[0] ?? null;
  const last = snapshots[snapshots.length - 1] ?? null;

  return {
    year,
    weekIndexes: snapshots.map((s) => s.weekIndex),
    weeksCount: snapshots.length,
    firstWeekLabel: first?.weekLabel ?? null,
    lastWeekLabel: last?.weekLabel ?? null,
    firstDateRange: first?.dateRange ?? null,
    lastDateRange: last?.dateRange ?? null,
    topSongs,
    topArtists,
    distinctSongsCount: songMap.size,
    distinctArtistsCount: artistMap.size,
    totalParadas,
  };
}
