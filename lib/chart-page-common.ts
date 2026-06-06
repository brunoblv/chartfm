import { buildWeekIndexFromDate, getPreviousClosedWeekDate } from "@/lib/chart-week";

export function pointsForPosition(position: number): number {
  return 101 - position;
}

export function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

export type WeeklyBucketsSerialized = Record<string, Record<string, number>>;

export function serializeWeeklyBuckets(
  buckets: Map<number, Map<string, number>>,
): WeeklyBucketsSerialized {
  const out: WeeklyBucketsSerialized = {};
  for (const [wk, bySong] of buckets) {
    out[String(wk)] = Object.fromEntries(bySong);
  }
  return out;
}

export function deserializeWeeklyBuckets(
  raw: WeeklyBucketsSerialized,
): Map<number, Map<string, number>> {
  const buckets = new Map<number, Map<string, number>>();
  for (const [wkStr, bySong] of Object.entries(raw)) {
    const wk = Number(wkStr);
    buckets.set(wk, new Map(Object.entries(bySong)));
  }
  return buckets;
}

export function currentWeekIdxBrt(now: Date = new Date()): number {
  const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const currentWeekDate = getPreviousClosedWeekDate(nowBRT);
  return buildWeekIndexFromDate(currentWeekDate);
}

export type GlobalSongStats = {
  weeks: number;
  peak: number;
  number1s: number;
  currentWeekPos: number;
};

export function buildWeeklyBucketsFromChartRows(
  rows: {
    position: number;
    points: number;
    chart: { weekIndex: number };
    song: { title: string; artist: string };
  }[],
): Map<number, Map<string, number>> {
  const weeklyBuckets = new Map<number, Map<string, number>>();
  for (const row of rows) {
    const wk = row.chart.weekIndex;
    const key = songKey(row.song.title, row.song.artist);
    const pts = row.points > 0 ? row.points : pointsForPosition(row.position);
    const bySong = weeklyBuckets.get(wk) ?? new Map<string, number>();
    bySong.set(key, (bySong.get(key) ?? 0) + pts);
    weeklyBuckets.set(wk, bySong);
  }
  return weeklyBuckets;
}

export function globalStatsForSongKeys(
  songKeys: Iterable<string>,
  weeklyBuckets: Map<number, Map<string, number>>,
  currentWeekIdx: number,
): Map<string, GlobalSongStats> {
  const keySet = new Set(songKeys);
  const globalStatsBySong = new Map<string, GlobalSongStats>();
  for (const key of keySet) {
    globalStatsBySong.set(key, { weeks: 0, peak: 9999, number1s: 0, currentWeekPos: 9999 });
  }
  for (const [wk, bySong] of weeklyBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    top100.forEach(([key], idx) => {
      if (!keySet.has(key)) return;
      const pos = idx + 1;
      const cur = globalStatsBySong.get(key)!;
      cur.weeks += 1;
      cur.peak = Math.min(cur.peak, pos);
      if (pos === 1) cur.number1s += 1;
      if (wk === currentWeekIdx) cur.currentWeekPos = pos;
      globalStatsBySong.set(key, cur);
    });
  }
  return globalStatsBySong;
}

export function globalStatsForSingleSong(
  targetKey: string,
  weeklyBuckets: Map<number, Map<string, number>>,
): Pick<GlobalSongStats, "weeks" | "peak" | "number1s"> {
  let weeks = 0;
  let peak = 9999;
  let number1s = 0;
  for (const [, bySong] of weeklyBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    const idx = top100.findIndex(([k]) => k === targetKey);
    if (idx >= 0) {
      const pos = idx + 1;
      weeks += 1;
      peak = Math.min(peak, pos);
      if (pos === 1) number1s += 1;
    }
  }
  return {
    weeks,
    peak: peak === 9999 ? 0 : peak,
    number1s,
  };
}
