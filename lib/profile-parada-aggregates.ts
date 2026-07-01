import { COVER_PALETTES } from "@/lib/data";
import {
  pointsForChartPosition,
  type ParadaScoringTier,
} from "@/lib/parada-points";
import type { Chart, Song } from "@/lib/types";

export type ArtistTableRow = {
  position: number;
  name: string;
  songCount: number;
  totalPoints: number;
  weeks: number;
  peak: number;
  numberOnes: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "return" | "up" | "down" | "same";
  growthPct: number | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
};

export type SongTableRow = {
  position: number;
  title: string;
  artist: string;
  songId?: string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
  totalPoints: number;
  weeks: number;
  peak: number;
  numberOnes: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "return" | "up" | "down" | "same";
  growthPct: number | null;
  cover: Chart["entries"][number]["cover"];
};

export type NumberOneRow = {
  title: string;
  artist: string;
  count: number;
  firstWeek: number;
  lastWeek: number;
  firstDateRange: string;
  lastDateRange: string;
  lastWeekLabel: string;
  cover: Chart["entries"][number]["cover"];
  songId?: string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
};

function pointsForPosition(
  position: number,
  tier: ParadaScoringTier,
  chartSize: number,
  cadence?: "weekly" | "daily",
) {
  return pointsForChartPosition(position, tier, chartSize, cadence);
}

function mergeArtistRouteMeta(
  cur: { artistSpotifyId?: string | null; artistRefId?: number | null },
  song: Song,
  key: string,
) {
  const primary = song.artist.trim() === key;
  if (!primary) return;
  if (song.artistRefId != null && cur.artistRefId == null)
    cur.artistRefId = song.artistRefId;
  const sid = song.artistSpotifyId?.trim();
  if (sid && !cur.artistSpotifyId) cur.artistSpotifyId = sid;
}

function mergeSongRouteMeta(
  cur: {
    songId?: string | null;
    slugArtist?: string | null;
    spotifyId?: string | null;
    artistSpotifyId?: string | null;
    artistRefId?: number | null;
  },
  song: Song,
) {
  if (song.artistRefId != null && cur.artistRefId == null)
    cur.artistRefId = song.artistRefId;
  const asid = song.artistSpotifyId?.trim();
  if (asid && !cur.artistSpotifyId) cur.artistSpotifyId = asid;
  const sid = song.spotifyId?.trim();
  if (sid && !cur.spotifyId) cur.spotifyId = sid;
  const id = song.id?.trim();
  if (id && !cur.songId) cur.songId = id;
  const slugA = song.slugArtist?.trim();
  if (slugA && !cur.slugArtist) cur.slugArtist = slugA;
}

export function countDistinctNumberOnes(charts: Chart[]) {
  const keys = new Set<string>();
  for (const c of charts) {
    for (const e of c.entries) {
      if (e.position === 1) keys.add(`${e.song.title}\0${e.song.artist}`);
    }
  }
  return keys.size;
}

export function colorForArtist(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

export function aggregateArtists(
  charts: Chart[],
  previousCharts: Chart[],
  tier: ParadaScoringTier = "primary",
  cadence?: "weekly" | "daily",
): ArtistTableRow[] {
  const map = new Map<
    string,
    {
      points: number;
      songs: Set<string>;
      weeks: Set<number>;
      peak: number;
      numberOnes: number;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();
  charts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const artists = [e.song.artist, ...(e.song.featArtists ?? [])]
        .map((a) => a.trim())
        .filter(Boolean);
      const unique = [...new Set(artists)];
      unique.forEach((key) => {
        const cur = map.get(key) ?? {
          points: 0,
          songs: new Set<string>(),
          weeks: new Set<number>(),
          peak: e.position,
          numberOnes: 0,
        };
        cur.points += pointsForPosition(e.position, tier, chartSize, cadence);
        cur.songs.add(e.song.title);
        cur.weeks.add(c.week);
        cur.peak = Math.min(cur.peak, e.position);
        if (e.position === 1) cur.numberOnes += 1;
        mergeArtistRouteMeta(cur, e.song, key);
        map.set(key, cur);
      });
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const artists = [e.song.artist, ...(e.song.featArtists ?? [])]
        .map((a) => a.trim())
        .filter(Boolean);
      const unique = [...new Set(artists)];
      unique.forEach((artist) => {
        prevMap.set(
          artist,
          (prevMap.get(artist) ?? 0) +
            pointsForPosition(e.position, tier, chartSize, cadence),
        );
      });
    });
  });
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([name, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(name) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: ArtistTableRow["status"] =
      prevPos === null
        ? "new"
        : delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down";
    const prevPoints = prevMap.get(name) ?? 0;
    const growthPct =
      prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      name,
      songCount: v.songs.size,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      numberOnes: v.numberOnes,
      prevPos,
      delta,
      status,
      growthPct,
      artistSpotifyId: v.artistSpotifyId,
      artistRefId: v.artistRefId,
    };
  });
}

export function aggregateSongs(
  charts: Chart[],
  previousCharts: Chart[],
  tier: ParadaScoringTier = "primary",
  cadence?: "weekly" | "daily",
): SongTableRow[] {
  const map = new Map<
    string,
    {
      title: string;
      artist: string;
      points: number;
      weeks: Set<number>;
      peak: number;
      numberOnes: number;
      cover: Chart["entries"][number]["cover"];
      songId?: string | null;
      slugArtist?: string | null;
      spotifyId?: string | null;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();
  charts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      const cur = map.get(key) ?? {
        title: e.song.title,
        artist: e.song.artist,
        points: 0,
        weeks: new Set<number>(),
        peak: e.position,
        numberOnes: 0,
        cover: e.cover,
      };
      cur.points += pointsForPosition(e.position, tier, chartSize, cadence);
      cur.weeks.add(c.week);
      const prevPeak = cur.peak;
      cur.peak = Math.min(cur.peak, e.position);
      if (e.position === 1) cur.numberOnes += 1;
      if (e.position < prevPeak) cur.cover = e.cover;
      mergeSongRouteMeta(cur, e.song);
      map.set(key, cur);
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      prevMap.set(
        key,
        (prevMap.get(key) ?? 0) +
          pointsForPosition(e.position, tier, chartSize, cadence),
      );
    });
  });
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([key, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: SongTableRow["status"] =
      prevPos === null
        ? "new"
        : delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down";
    const prevPoints = prevMap.get(key) ?? 0;
    const growthPct =
      prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      title: v.title,
      artist: v.artist,
      songId: v.songId,
      slugArtist: v.slugArtist,
      spotifyId: v.spotifyId,
      artistSpotifyId: v.artistSpotifyId,
      artistRefId: v.artistRefId,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      numberOnes: v.numberOnes,
      prevPos,
      delta,
      status,
      growthPct,
      cover: v.cover,
    };
  });
}

export function buildNumberOnesList(charts: Chart[]): NumberOneRow[] {
  const map = new Map<
    string,
    {
      title: string;
      artist: string;
      count: number;
      firstWeek: number;
      lastWeek: number;
      firstDateRange: string;
      lastDateRange: string;
      lastWeekLabel: string;
      cover: Chart["entries"][number]["cover"];
      songId?: string | null;
      slugArtist?: string | null;
      spotifyId?: string | null;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();

  const sorted = [...charts].sort((a, b) => a.week - b.week);
  for (const chart of sorted) {
    const entry = chart.entries.find((e) => e.position === 1);
    if (!entry) continue;
    const key = `${entry.song.title}\0${entry.song.artist}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        title: entry.song.title,
        artist: entry.song.artist,
        count: 1,
        firstWeek: chart.week,
        lastWeek: chart.week,
        firstDateRange: chart.dateRange,
        lastDateRange: chart.dateRange,
        lastWeekLabel: chart.weekLabel,
        cover: entry.cover,
        songId: entry.song.id,
        slugArtist: entry.song.slugArtist,
        spotifyId: entry.song.spotifyId,
        artistSpotifyId: entry.song.artistSpotifyId,
        artistRefId: entry.song.artistRefId,
      });
      continue;
    }
    cur.count += 1;
    cur.lastWeek = chart.week;
    cur.lastDateRange = chart.dateRange;
    cur.lastWeekLabel = chart.weekLabel;
    cur.cover = entry.cover;
    mergeSongRouteMeta(cur, entry.song);
  }

  return [...map.values()].sort(
    (a, b) => b.lastWeek - a.lastWeek || b.count - a.count,
  );
}
