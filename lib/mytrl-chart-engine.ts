import type { TrackPlays } from "./lastfm";
import { buildWeekIndexFromDate, buildWeekLabelFromDate, prevChartWeekIndex } from "./chart-week";

/** Peso por idade do play (1 = ontem … 7 = há 7 dias). */
const DAY_WEIGHTS = [20, 18, 15, 13, 12, 11, 10] as const;

export type MyTrlEntryStatus = "new" | "return" | "up" | "down" | "same";

export interface MyTrlChartEntry {
  track: string;
  artist: string;
  album: string;
  spotifyId: string | null;
  imageUrl: string | null;
  score: number;
  position: number;
  prevPos: number | null;
  peak: number;
  weeks: number;
  numberOnes: number;
  status: MyTrlEntryStatus;
  delta: number | null;
}

export interface MyTrlSnapshotPayload {
  computedAt: string;
  entries: MyTrlChartEntry[];
}

export type MyTrlHistory = Record<string, MyTrlSnapshotPayload>;

export const MYTRL_WEEKDAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
] as const;

/** Offset fixo BRT (UTC−3), alinhado ao restante do projeto. */
export function toBrtDate(utc: Date = new Date()): Date {
  return new Date(utc.getTime() - 3 * 60 * 60 * 1000);
}

export function brtDateKey(date: Date): string {
  const brt = toBrtDate(date);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function brtWeekday(date: Date = new Date()): number {
  const day = toBrtDate(date).getUTCDay();
  if (day >= 1 && day <= 5) return day;
  return 0;
}

export function myTrlSnapshotKey(weekday: number, weekIndex: number): string {
  return `${weekday}:${weekIndex}`;
}

function playWeight(diffDays: number): number {
  if (diffDays < 1 || diffDays > 7) return 0;
  return DAY_WEIGHTS[diffDays - 1];
}

function computeScore(dayPlays: TrackPlays["dayPlays"], referenceDayKey: string): number {
  const refMs = new Date(`${referenceDayKey}T00:00:00Z`).getTime();
  let score = 0;

  for (const { date, plays } of dayPlays) {
    const playMs = new Date(`${date}T00:00:00Z`).getTime();
    const diffDays = Math.round((refMs - playMs) / 86_400_000);
    const w = playWeight(diffDays);
    if (w === 0) continue;
    score += plays * w;
  }

  return score;
}

export function buildMyTrlDateRange(referenceDayKey: string): string {
  const ref = new Date(`${referenceDayKey}T00:00:00Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - 7);

  const fmt = (d: Date) => {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  };

  const endYear = ref.getUTCFullYear();
  return `${fmt(start)} – ${fmt(ref)}/${endYear}`;
}

function trackKey(track: string, artist: string, spotifyId?: string | null): string {
  if (spotifyId) return `sp:${spotifyId}`;
  return `na:${track.toLowerCase()}|||${artist.toLowerCase()}`;
}

function aggregateHistoryStats(
  key: string,
  weekday: number,
  weekIndex: number,
  history: MyTrlHistory,
  currentPosition: number,
): { weeks: number; peak: number; numberOnes: number; everOnChart: boolean } {
  let weeks = 0;
  let peak = currentPosition;
  let numberOnes = 0;
  let everOnChart = false;

  for (const [snapKey, snap] of Object.entries(history)) {
    const [wd, wi] = snapKey.split(":").map(Number);
    if (wd !== weekday || wi === weekIndex) continue;

    const entry = snap.entries.find((e) => trackKey(e.track, e.artist, e.spotifyId) === key);
    if (!entry) continue;

    everOnChart = true;
    weeks += 1;
    if (entry.position < peak) peak = entry.position;
    if (entry.position === 1) numberOnes += 1;
  }

  return { weeks, peak, numberOnes, everOnChart };
}

export function computeMyTrlChart(
  trackPlays: TrackPlays[],
  allowedSpotifyIds: Set<string>,
  history: MyTrlHistory,
  weekday: number,
  weekIndex: number,
  referenceDay: Date = new Date(),
): MyTrlChartEntry[] {
  const referenceDayKey = brtDateKey(referenceDay);
  const prevKey = myTrlSnapshotKey(weekday, prevChartWeekIndex(weekIndex));
  const prevSnapshot = history[prevKey] ?? null;

  const prevMap = new Map<string, MyTrlChartEntry>();
  if (prevSnapshot) {
    for (const entry of prevSnapshot.entries) {
      prevMap.set(trackKey(entry.track, entry.artist, entry.spotifyId), entry);
    }
  }

  const ranked = trackPlays
    .filter((tp) => {
      const enrichedId = (tp as TrackPlays & { spotifyId?: string | null }).spotifyId;
      if (enrichedId && allowedSpotifyIds.has(enrichedId)) return true;
      return false;
    })
    .map((tp) => ({
      ...tp,
      score: computeScore(tp.dayPlays, referenceDayKey),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return ranked.map((item, i) => {
    const position = i + 1;
    const key = trackKey(item.track, item.artist, (item as typeof item & { spotifyId?: string }).spotifyId);
    const prev = prevMap.get(key);
    const prevPos = prev?.position ?? null;

    const histStats = aggregateHistoryStats(key, weekday, weekIndex, history, position);
    let peak = Math.min(histStats.peak, position);
    const weeks = histStats.weeks + 1;
    const numberOnes = histStats.numberOnes + (position === 1 ? 1 : 0);

    let status: MyTrlEntryStatus;
    let delta: number | null;

    if (prevPos === null && !histStats.everOnChart) {
      status = "new";
      delta = null;
    } else if (prevPos === null) {
      status = "return";
      delta = null;
    } else if (position < prevPos) {
      status = "up";
      delta = prevPos - position;
    } else if (position > prevPos) {
      status = "down";
      delta = position - prevPos;
    } else {
      status = "same";
      delta = 0;
    }

    const spotifyId = (item as TrackPlays & { spotifyId?: string | null; imageUrl?: string | null }).spotifyId ?? null;
    const imageUrl = (item as TrackPlays & { imageUrl?: string | null }).imageUrl ?? null;

    return {
      track: item.track,
      artist: item.artist,
      album: item.album,
      spotifyId,
      imageUrl,
      score: Math.round(item.score * 100) / 100,
      position,
      prevPos,
      peak,
      weeks,
      numberOnes,
      status,
      delta,
    };
  });
}

export function buildMyTrlPeriod(referenceDay: Date = new Date()) {
  const weekIndex = buildWeekIndexFromDate(referenceDay);
  const weekLabel = buildWeekLabelFromDate(referenceDay);
  const dateRange = buildMyTrlDateRange(brtDateKey(referenceDay));
  return { weekIndex, weekLabel, dateRange };
}

export function myTrlFetchWindow(referenceDay: Date = new Date()): { fromUnix: number; toUnix: number } {
  const refKey = brtDateKey(referenceDay);
  const ref = new Date(`${refKey}T00:00:00Z`);
  const from = new Date(ref);
  from.setUTCDate(from.getUTCDate() - 7);
  const toUnix = Math.floor(referenceDay.getTime() / 1000) + 1;
  const fromUnix = Math.floor(from.getTime() / 1000);
  return { fromUnix, toUnix };
}
