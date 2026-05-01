import type { GlobalChartEntry, Song } from "@/lib/types";

/** Linha mínima vinda do Prisma para agregar a parada global da semana. */
export type WeeklyChartEntryRow = {
  position: number;
  points: number;
  chartId: string;
  coverPaletteA: string;
  coverPaletteB: string;
  coverSeed: number;
  song: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    coverImageUrl?: string | null;
    albumRef?: { coverUrl?: string | null } | null;
    spotifyId: string | null;
    artistSpotifyId: string | null;
    artistRef: { spotifyId: string; name: string } | null;
    feats?: Array<{ artist: { spotifyId: string; name: string } }>;
  };
};

export function pointsForChartPosition(position: number): number {
  return 101 - position;
}

function pointsForWeeklyEntry(entry: WeeklyChartEntryRow): number {
  return entry.points > 0 ? entry.points : pointsForChartPosition(entry.position);
}

/** Agrupa créditos do mesmo artista (Spotify) mesmo com `song.artist` escrito diferente. */
export function artistAggregationKey(song: WeeklyChartEntryRow["song"]): string {
  const sid = song.artistRef?.spotifyId ?? song.artistSpotifyId;
  if (sid) return `artist_spotify:${sid}`;
  const n = song.artist.trim().replace(/\s+/g, " ").toLowerCase();
  return `artist_name:${n}`;
}

export function artistDisplayName(song: WeeklyChartEntryRow["song"]): string {
  const ref = song.artistRef?.name?.trim();
  if (ref) return ref;
  return song.artist.trim().replace(/\s+/g, " ");
}

type ArtistContributor = { key: string; name: string; spotifyId: string | null };

function artistContributors(song: WeeklyChartEntryRow["song"]): ArtistContributor[] {
  const out: ArtistContributor[] = [];
  const seen = new Set<string>();
  const push = (nameRaw: string, sidRaw: string | null | undefined) => {
    const name = nameRaw.trim().replace(/\s+/g, " ");
    if (!name) return;
    const sid = sidRaw?.trim() || null;
    const key = sid ? `artist_spotify:${sid}` : `artist_name:${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, name, spotifyId: sid });
  };
  push(artistDisplayName(song), song.artistRef?.spotifyId ?? song.artistSpotifyId ?? null);
  for (const feat of song.feats ?? []) {
    push(feat.artist.name, feat.artist.spotifyId);
  }
  return out;
}

function songAggregationKey(song: WeeklyChartEntryRow["song"]): string {
  if (song.spotifyId) return `song_spotify:${song.spotifyId}`;
  const t = song.title.trim().replace(/\s+/g, " ").toLowerCase();
  const a = song.artist.trim().replace(/\s+/g, " ").toLowerCase();
  return `song_local:${t}|${a}`;
}

export type TopArtistRow = {
  position: number;
  name: string;
  totalPoints: number;
  chartCount: number;
  /** ID Spotify do artista primário, quando a música veio do Spotify. */
  spotifyId: string | null;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  growthPct: number | null;
  peak: number;
  weeks: number;
};

type AggregateArtistOptions = {
  previousWeekEntries?: WeeklyChartEntryRow[];
  historicalStatsByArtistKey?: Map<string, { peak?: number; weeks?: number }>;
  comparisonEntries?: WeeklyChartEntryRow[];
};

export function aggregateTopArtists(
  entries: WeeklyChartEntryRow[],
  limit = 100,
  options?: AggregateArtistOptions
): TopArtistRow[] {
  const byKey = new Map<
    string,
    { points: number; charts: Set<string>; displayName: string; spotifyId: string | null }
  >();
  for (const e of entries) {
    const pts = pointsForWeeklyEntry(e);
    for (const contributor of artistContributors(e.song)) {
      const cur = byKey.get(contributor.key) ?? {
        points: 0,
        charts: new Set<string>(),
        displayName: contributor.name,
        spotifyId: null as string | null,
      };
      cur.points += pts;
      cur.charts.add(e.chartId);
      cur.displayName = contributor.name;
      if (contributor.spotifyId) cur.spotifyId = cur.spotifyId ?? contributor.spotifyId;
      byKey.set(contributor.key, cur);
    }
  }

  // Merge name-based buckets into matching Spotify-based buckets so that the
  // same artist doesn't appear twice when some songs were added without Spotify lookup.
  const spotifyKeyByName = new Map<string, string>();
  for (const [key, val] of byKey) {
    if (key.startsWith("artist_spotify:")) {
      spotifyKeyByName.set(val.displayName.toLowerCase(), key);
    }
  }
  for (const [key, val] of [...byKey]) {
    if (!key.startsWith("artist_name:")) continue;
    const spotifyKey = spotifyKeyByName.get(val.displayName.toLowerCase());
    if (!spotifyKey) continue;
    const target = byKey.get(spotifyKey)!;
    target.points += val.points;
    for (const c of val.charts) target.charts.add(c);
    byKey.delete(key);
  }

  const sorted = Array.from(byKey.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, limit);

  const comparisonByArtist = new Map<string, number>();
  if (options?.comparisonEntries?.length) {
    for (const e of options.comparisonEntries) {
      for (const contributor of artistContributors(e.song)) {
        comparisonByArtist.set(
          contributor.key,
          (comparisonByArtist.get(contributor.key) ?? 0) + pointsForWeeklyEntry(e)
        );
      }
    }
  }

  const prevPosByArtist = new Map<string, number>();
  if (options?.previousWeekEntries?.length) {
    const prevByArtist = new Map<string, number>();
    for (const e of options.previousWeekEntries) {
      for (const contributor of artistContributors(e.song)) {
        prevByArtist.set(
          contributor.key,
          (prevByArtist.get(contributor.key) ?? 0) + pointsForWeeklyEntry(e)
        );
      }
    }
    [...prevByArtist.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k], i) => prevPosByArtist.set(k, i + 1));
  }

  return sorted.map(([k, v], i) => {
    const position = i + 1;
    const prevPos = prevPosByArtist.get(k) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: TopArtistRow["status"] =
      prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    const historical = options?.historicalStatsByArtistKey?.get(k);
    const prevPoints = comparisonByArtist.get(k) ?? 0;
    const growthPct = prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      name: v.displayName,
      totalPoints: v.points,
      chartCount: v.charts.size,
      spotifyId: v.spotifyId,
      status,
      delta,
      prevPos,
      growthPct,
      peak: historical?.peak ?? position,
      weeks: historical?.weeks ?? 1,
    };
  });
}

type SongAgg = {
  key: string;
  pts: number;
  charts: Set<string>;
  best: WeeklyChartEntryRow;
};

type GlobalSongStats = { peak?: number; weeks?: number };

type AggregateGlobalSongsOptions = {
  previousWeekEntries?: WeeklyChartEntryRow[];
  historicalStatsBySongKey?: Map<string, GlobalSongStats>;
  comparisonEntries?: WeeklyChartEntryRow[];
};

export function aggregateGlobalSongs(
  entries: WeeklyChartEntryRow[],
  limit = 100,
  options?: AggregateGlobalSongsOptions
): GlobalChartEntry[] {
  const map = new Map<string, SongAgg>();
  for (const e of entries) {
    const key = songAggregationKey(e.song);
    const pts = pointsForWeeklyEntry(e);
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { key, pts, charts: new Set([e.chartId]), best: e });
      continue;
    }
    cur.pts += pts;
    cur.charts.add(e.chartId);
    if (e.position < cur.best.position) cur.best = e;
  }

  const sorted = [...map.values()].sort((a, b) => b.pts - a.pts).slice(0, limit);

  const prevPosBySong = new Map<string, number>();
  if (options?.previousWeekEntries?.length) {
    const prevMap = new Map<string, number>();
    for (const e of options.previousWeekEntries) {
      const key = songAggregationKey(e.song);
      prevMap.set(key, (prevMap.get(key) ?? 0) + pointsForWeeklyEntry(e));
    }
    [...prevMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([key], i) => prevPosBySong.set(key, i + 1));
  }

  const comparisonBySong = new Map<string, number>();
  if (options?.comparisonEntries?.length) {
    for (const e of options.comparisonEntries) {
      const key = songAggregationKey(e.song);
      comparisonBySong.set(key, (comparisonBySong.get(key) ?? 0) + pointsForWeeklyEntry(e));
    }
  }

  return sorted.map((row, i) => {
    const position = i + 1;
    const prevPos = prevPosBySong.get(row.key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    let status: GlobalChartEntry["status"] = "new";
    if (prevPos !== null) {
      if (delta === 0) status = "same";
      else if ((delta ?? 0) > 0) status = "up";
      else status = "down";
    }
    const historical = options?.historicalStatsBySongKey?.get(row.key);
    const prevPoints = comparisonBySong.get(row.key) ?? 0;
    const growthPct = prevPoints > 0 ? ((row.pts - prevPoints) / prevPoints) * 100 : null;
    const s = row.best.song;
    const manualCover = s.albumRef?.coverUrl?.trim() || null;
    const song: Song = {
      id: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album ?? "",
      spotifyId: s.spotifyId ?? null,
      artistSpotifyId: s.artistSpotifyId ?? null,
      imageUrl: manualCover,
    };
    return {
      position,
      song,
      cover: {
        palette: [row.best.coverPaletteA, row.best.coverPaletteB] as [string, string],
        seed: row.best.coverSeed,
        imageUrl: manualCover,
      },
      points: row.pts,
      voters: row.charts.size,
      status,
      delta,
      prevPos,
      growthPct,
      peak: historical?.peak ?? row.best.position,
      weeks: historical?.weeks ?? row.charts.size,
    };
  });
}
