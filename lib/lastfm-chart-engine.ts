import type { TrackPlays } from "./lastfm";

/**
 * Peso por idade do play em relação a `referenceDay` (diffDays = dias corridos UTC):
 * 0–6: ×5 | 7–14: ×3 | 15–29: ×2 (fora da janela 30 dias → 0).
 */
function playBlockWeight(diffDays: number): number {
  if (diffDays < 0 || diffDays >= 30) return 0;
  if (diffDays < 7) return 5;
  if (diffDays < 15) return 3;
  return 2;
}


export type ChartEntryStatus = "new" | "up" | "down" | "steady" | "re-entry";

export interface LastfmChartEntry {
  track: string;
  artist: string;
  album: string;
  score: number;
  current_position: number;
  last_week_position: number | null;
  peak_position: number;
  weeks_on_chart: number;
  status: ChartEntryStatus;
}

export interface LastfmSnapshot {
  computedAt: string;
  entries: LastfmChartEntry[];
}

export type LastfmSnapshotHistory = Record<string, LastfmSnapshot>;

export function getSundayKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // roll back to Sunday
  return d.toISOString().slice(0, 10);
}

function prevSundayKey(current: string): string {
  const d = new Date(current + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Score total = Σ plays(dia) × peso do bloco de 28 dias em que cai o dia,
 * com `referenceDay` = “hoje” do modelo (últimos 7 dias = diffDays 0–6).
 */
function computeScore(dayPlays: TrackPlays["dayPlays"], referenceDay: Date): number {
  const todayMs = Date.UTC(referenceDay.getUTCFullYear(), referenceDay.getUTCMonth(), referenceDay.getUTCDate());
  let score = 0;

  for (const { date, plays } of dayPlays) {
    const playMs = new Date(date + "T00:00:00Z").getTime();
    const diffDays = Math.round((todayMs - playMs) / 86_400_000);

    const w = playBlockWeight(diffDays);
    if (w === 0) continue;

    score += plays * w;
  }

  return score;
}

export function scoreLastfmTracks(
  trackPlays: TrackPlays[],
  /** Fim do período em UTC (import 30d: `new Date()`; import por semana: domingo fim da parada). Blocos ×5 (0–6d) / ×3 (7–14d) / ×2 (15–29d). */
  referenceDay: Date = new Date(),
  limit = 200,
  minScore = 0,
): Array<{ track: string; artist: string; album: string; score: number }> {
  return trackPlays
    .map((tp) => ({ track: tp.track, artist: tp.artist, album: tp.album, score: computeScore(tp.dayPlays, referenceDay) }))
    .filter((s) => s.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function computeLastfmChart(
  trackPlays: TrackPlays[],
  history: LastfmSnapshotHistory,
  today: Date = new Date(),
): LastfmChartEntry[] {
  const currentSunday = getSundayKey(today);
  const prevSnapshot = history[prevSundayKey(currentSunday)] ?? null;

  const lastWeekMap = new Map<string, LastfmChartEntry>();
  if (prevSnapshot) {
    for (const entry of prevSnapshot.entries) {
      lastWeekMap.set(`${entry.track.toLowerCase()}|||${entry.artist.toLowerCase()}`, entry);
    }
  }

  // All track keys that ever appeared in any snapshot (for re-entry detection)
  const everOnChart = new Set<string>();
  for (const snap of Object.values(history)) {
    for (const entry of snap.entries) {
      everOnChart.add(`${entry.track.toLowerCase()}|||${entry.artist.toLowerCase()}`);
    }
  }

  const top10 = trackPlays
    .map((tp) => ({ ...tp, score: computeScore(tp.dayPlays, today) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return top10.map((item, i) => {
    const currentPosition = i + 1;
    const key = `${item.track.toLowerCase()}|||${item.artist.toLowerCase()}`;
    const prev = lastWeekMap.get(key);
    const lastWeekPosition = prev?.current_position ?? null;
    const prevWeeks = prev?.weeks_on_chart ?? 0;

    let peakPosition = prev?.peak_position ?? currentPosition;
    if (currentPosition < peakPosition) peakPosition = currentPosition;

    let status: ChartEntryStatus;
    let weeksOnChart: number;

    if (lastWeekPosition === null && !everOnChart.has(key)) {
      status = "new";
      weeksOnChart = 1;
    } else if (lastWeekPosition === null) {
      status = "re-entry";
      weeksOnChart = prevWeeks + 1;
    } else if (currentPosition < lastWeekPosition) {
      status = "up";
      weeksOnChart = prevWeeks + 1;
    } else if (currentPosition > lastWeekPosition) {
      status = "down";
      weeksOnChart = prevWeeks + 1;
    } else {
      status = "steady";
      weeksOnChart = prevWeeks + 1;
    }

    return {
      track: item.track,
      artist: item.artist,
      album: item.album,
      score: Math.round(item.score * 100) / 100,
      current_position: currentPosition,
      last_week_position: lastWeekPosition,
      peak_position: peakPosition,
      weeks_on_chart: weeksOnChart,
      status,
    };
  });
}
