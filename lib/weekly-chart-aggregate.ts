import type { GlobalChartEntry, Song } from "@/lib/types";
import { calcularPontosPrimary } from "@/lib/parada-points";

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
    albumRef?: { id?: number | null; coverUrl?: string | null } | null;
    spotifyId: string | null;
    artistSpotifyId: string | null;
    artistRef: { spotifyId: string; name: string; id?: number | null } | null;
    feats?: Array<{ artist: { spotifyId: string; name: string } }>;
  };
};

export function pointsForChartPosition(position: number): number {
  return calcularPontosPrimary(position);
}

/**
 * Pesos do Global 100.
 * Curva geométrica: o #1 de cada parada vale GLOBAL_TOP_POINTS e cada posição
 * abaixo vale GLOBAL_DECAY_RATIO da anterior. Isso valoriza o topo (convicção)
 * sobre o volume de paradas em que a música aparece.
 */
export const GLOBAL_TOP_POINTS = 1000;
export const GLOBAL_DECAY_RATIO = 0.95;

export function globalWeight(position: number): number {
  return Math.round(GLOBAL_TOP_POINTS * Math.pow(GLOBAL_DECAY_RATIO, position - 1));
}

/**
 * "stored": usa os pontos persistidos na ChartEntry (escala da própria parada).
 * "global": usa a curva geométrica do Global 100 a partir da posição.
 */
export type WeightMode = "stored" | "global";

function pointsForWeeklyEntry(entry: WeeklyChartEntryRow, mode: WeightMode = "stored"): number {
  if (mode === "global") return globalWeight(entry.position);
  // `stored`: usa pontos persistidos. Só cai na escala por posição quando a entrada
  // ainda não foi pontuada (0). Quem precisa de "0 intencional" (ex.: tabela custom
  // da comunidade) deve filtrar essas linhas antes de agregar — ver applyCommunityPointRules.
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
  numberOnes: number;
};

type AggregateArtistOptions = {
  previousWeekEntries?: WeeklyChartEntryRow[];
  historicalStatsByArtistKey?: Map<string, { peak?: number; weeks?: number; numberOnes?: number }>;
  comparisonEntries?: WeeklyChartEntryRow[];
  prevPositionsByKey?: Map<string, number>;
  weightMode?: WeightMode;
};

export function aggregateTopArtists(
  entries: WeeklyChartEntryRow[],
  limit = 100,
  options?: AggregateArtistOptions
): TopArtistRow[] {
  const mode = options?.weightMode ?? "stored";
  const byKey = new Map<
    string,
    { points: number; charts: Set<string>; displayName: string; spotifyId: string | null }
  >();
  for (const e of entries) {
    const pts = pointsForWeeklyEntry(e, mode);
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
          (comparisonByArtist.get(contributor.key) ?? 0) + pointsForWeeklyEntry(e, mode)
        );
      }
    }
  }

  const prevPosByArtist: Map<string, number> = (() => {
    if (options?.prevPositionsByKey) return new Map(options.prevPositionsByKey);
    const map = new Map<string, number>();
    if (options?.previousWeekEntries?.length) {
      const prevByArtist = new Map<string, number>();
      for (const e of options.previousWeekEntries) {
        for (const contributor of artistContributors(e.song)) {
          prevByArtist.set(
            contributor.key,
            (prevByArtist.get(contributor.key) ?? 0) + pointsForWeeklyEntry(e, mode)
          );
        }
      }
      [...prevByArtist.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .forEach(([k], i) => map.set(k, i + 1));
    }
    return map;
  })();

  return sorted.map(([k, v], i) => {
    const position = i + 1;
    const prevPos = prevPosByArtist.get(k) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const historical = options?.historicalStatsByArtistKey?.get(k);
    let status: TopArtistRow["status"] = "new";
    if (prevPos !== null) {
      status = delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    } else if ((historical?.weeks ?? 0) > 0) {
      status = "return";
    }
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
      peak: Math.min(historical?.peak ?? position, position),
      weeks: (historical?.weeks ?? 0) + 1,
      numberOnes: (historical?.numberOnes ?? 0) + (position === 1 ? 1 : 0),
    };
  });
}

type SongAgg = {
  key: string;
  pts: number;
  charts: Set<string>;
  best: WeeklyChartEntryRow;
};

type GlobalSongStats = { peak?: number; weeks?: number; numberOnes?: number };

type AggregateGlobalSongsOptions = {
  previousWeekEntries?: WeeklyChartEntryRow[];
  historicalStatsBySongKey?: Map<string, GlobalSongStats>;
  comparisonEntries?: WeeklyChartEntryRow[];
  prevPositionsByKey?: Map<string, number>;
  weightMode?: WeightMode;
};

export function aggregateGlobalSongs(
  entries: WeeklyChartEntryRow[],
  limit = 100,
  options?: AggregateGlobalSongsOptions
): GlobalChartEntry[] {
  const mode = options?.weightMode ?? "stored";
  const map = new Map<string, SongAgg>();
  for (const e of entries) {
    const key = songAggregationKey(e.song);
    const pts = pointsForWeeklyEntry(e, mode);
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

  const prevPosBySong: Map<string, number> = (() => {
    if (options?.prevPositionsByKey) return new Map(options.prevPositionsByKey);
    const map = new Map<string, number>();
    if (options?.previousWeekEntries?.length) {
      const prevMap = new Map<string, number>();
      for (const e of options.previousWeekEntries) {
        const key = songAggregationKey(e.song);
        prevMap.set(key, (prevMap.get(key) ?? 0) + pointsForWeeklyEntry(e, mode));
      }
      [...prevMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .forEach(([key], i) => map.set(key, i + 1));
    }
    return map;
  })();

  const comparisonBySong = new Map<string, number>();
  if (options?.comparisonEntries?.length) {
    for (const e of options.comparisonEntries) {
      const key = songAggregationKey(e.song);
      comparisonBySong.set(key, (comparisonBySong.get(key) ?? 0) + pointsForWeeklyEntry(e, mode));
    }
  }

  return sorted.map((row, i) => {
    const position = i + 1;
    const prevPos = prevPosBySong.get(row.key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const historical = options?.historicalStatsBySongKey?.get(row.key);
    let status: GlobalChartEntry["status"] = "new";
    if (prevPos !== null) {
      if (delta === 0) status = "same";
      else if ((delta ?? 0) > 0) status = "up";
      else status = "down";
    } else if ((historical?.weeks ?? 0) > 0) {
      status = "return";
    }
    const prevPoints = comparisonBySong.get(row.key) ?? 0;
    const growthPct = prevPoints > 0 ? ((row.pts - prevPoints) / prevPoints) * 100 : null;
    const s = row.best.song;
    const manualCover = s.albumRef?.coverUrl?.trim() || null;
    const song: Song = {
      id: s.id,
      title: s.title,
      artist: artistDisplayName(s),
      slugArtist: s.artist,
      album: s.album ?? "",
      spotifyId: s.spotifyId ?? null,
      artistSpotifyId: s.artistSpotifyId ?? null,
      artistRefId: s.artistRef?.id ?? null,
      albumRefId: s.albumRef?.id ?? null,
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
      peak: Math.min(historical?.peak ?? position, position),
      weeks: (historical?.weeks ?? 0) + 1,
      numberOnes: (historical?.numberOnes ?? 0) + (position === 1 ? 1 : 0),
    };
  });
}
