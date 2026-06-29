import type { TrackPlays } from "./lastfm";
import { buildWeekIndexFromDate, buildWeekLabelFromDate, prevChartWeekIndex } from "./chart-week";

/** Peso por idade do play (1 = ontem … 7 = há 7 dias). */
const DAY_WEIGHTS = [25, 15, 14, 13, 12, 11, 10] as const;

export type MyTrlEntryStatus = "new" | "return" | "up" | "down" | "same";

export interface MyTrlChartEntry {
  track: string;
  artist: string;
  album: string;
  spotifyId: string | null;
  imageUrl: string | null;
  /** Plays por dia BRT na janela de pontuação (últimos 7 dias). */
  dayPlays?: Array<{ date: string; plays: number }>;
  score: number;
  /** Top 10 diário; `null` = fora do top 10 mas com pontos salvos. */
  position: number | null;
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

/** Entradas ranqueadas no top diário (com posição). */
export function myTrlTopEntries(entries: MyTrlChartEntry[], limit = 10): MyTrlChartEntry[] {
  return entries
    .filter((e) => e.position != null)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .slice(0, limit);
}

/** Ordem cronológica das paradas diárias (seg–sex dentro de cada semana ISO). */
export function isEditionBefore(
  weekday: number,
  weekIndex: number,
  targetWeekday: number,
  targetWeekIndex: number,
): boolean {
  if (weekIndex < targetWeekIndex) return true;
  if (weekIndex > targetWeekIndex) return false;
  return weekday < targetWeekday;
}

/** Edição imediatamente anterior: ter–sex → dia anterior; seg → sex da semana ISO anterior. */
export function prevMyTrlEditionKey(weekday: number, weekIndex: number): string | null {
  if (weekday > 1) return myTrlSnapshotKey(weekday - 1, weekIndex);
  if (weekday === 1) return myTrlSnapshotKey(5, prevChartWeekIndex(weekIndex));
  return null;
}

function playWeight(diffDays: number): number {
  if (diffDays < 1 || diffDays > 7) return 0;
  return DAY_WEIGHTS[diffDays - 1];
}

/** Plays por dia BRT que entram na pontuação (1–7 dias antes da edição). */
function scoringDayPlays(dayPlays: TrackPlays["dayPlays"], referenceDayKey: string): Array<{ date: string; plays: number }> {
  const refMs = new Date(`${referenceDayKey}T00:00:00Z`).getTime();
  const out: Array<{ date: string; plays: number }> = [];

  for (const { date, plays } of dayPlays) {
    const playMs = new Date(`${date}T00:00:00Z`).getTime();
    const diffDays = Math.round((refMs - playMs) / 86_400_000);
    if (playWeight(diffDays) > 0) out.push({ date, plays });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
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

/** Rótulo dos 7 dias BRT que entram na pontuação (ontem até há 7 dias; exclui o dia da edição). */
export function buildMyTrlScoringWindow(referenceDayKey: string): string {
  const ref = new Date(`${referenceDayKey}T00:00:00Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(ref);
  end.setUTCDate(end.getUTCDate() - 1);

  const fmt = (d: Date) => {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  };

  const endYear = end.getUTCFullYear();
  return `${fmt(start)} – ${fmt(end)}/${endYear}`;
}

/** Rótulo da edição diária (data da parada). */
export function buildMyTrlEditionDate(referenceDay: Date = new Date()): string {
  return formatMyTrlEditionDisplay(referenceDay).fullLabel;
}

export type MyTrlEditionDisplay = {
  weekdayLabel: string;
  dayOfMonth: number;
  monthLabel: string;
  year: number;
  /** Ex.: "Sexta, 14 de junho de 2026" */
  fullLabel: string;
  /** Ex.: "Sexta · 14/06" */
  shortLabel: string;
};

const MONTH_NAMES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Dia da semana + dia do mês da parada (sempre a partir da data BRT da edição). */
export function formatMyTrlEditionDisplay(referenceDay: Date = new Date()): MyTrlEditionDisplay {
  const brt = toBrtDate(referenceDay);
  const dayOfMonth = brt.getUTCDate();
  const monthIndex = brt.getUTCMonth();
  const year = brt.getUTCFullYear();
  const monthLabel = MONTH_NAMES_PT[monthIndex] ?? "";
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const wd = brtWeekday(referenceDay);
  const weekdayLabel = MYTRL_WEEKDAYS.find((d) => d.value === wd)?.label ?? "";
  const dd = String(dayOfMonth).padStart(2, "0");
  const mm = String(monthIndex + 1).padStart(2, "0");

  const fullLabel = weekdayLabel
    ? `${weekdayLabel}, ${dayOfMonth} de ${monthCap} de ${year}`
    : `${dayOfMonth} de ${monthCap} de ${year}`;

  return {
    weekdayLabel,
    dayOfMonth,
    monthLabel: monthCap,
    year,
    fullLabel,
    shortLabel: weekdayLabel ? `${weekdayLabel} · ${dd}/${mm}` : `${dd}/${mm}/${year}`,
  };
}

/** @deprecated Use buildMyTrlScoringWindow — mantido para compatibilidade. */
export function buildMyTrlDateRange(referenceDayKey: string): string {
  return buildMyTrlScoringWindow(referenceDayKey);
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
): { peak: number; numberOnes: number; everOnChart: boolean } {
  let peak = currentPosition;
  let numberOnes = 0;
  let everOnChart = false;

  for (const [snapKey, snap] of Object.entries(history)) {
    const [wd, wi] = snapKey.split(":").map(Number);
    if (!isEditionBefore(wd, wi, weekday, weekIndex)) continue;

    const entry = snap.entries.find(
      (e) => e.position != null && trackKey(e.track, e.artist, e.spotifyId) === key,
    );
    if (!entry || entry.position == null) continue;

    everOnChart = true;
    if (entry.position < peak) peak = entry.position;
    if (entry.position === 1) numberOnes += 1;
  }

  return { peak, numberOnes, everOnChart };
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
  const prevKey = prevMyTrlEditionKey(weekday, weekIndex);
  const prevSnapshot = prevKey ? (history[prevKey] ?? null) : null;

  const prevMap = new Map<string, MyTrlChartEntry>();
  if (prevSnapshot) {
    for (const entry of prevSnapshot.entries) {
      if (entry.position == null) continue;
      for (const k of new Set([
        trackKey(entry.track, entry.artist, entry.spotifyId),
        trackKey(entry.track, entry.artist, null),
      ])) {
        prevMap.set(k, entry);
      }
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
    .sort((a, b) => b.score - a.score);

  return ranked.map((item, i) => {
    const spotifyId = (item as TrackPlays & { spotifyId?: string | null; imageUrl?: string | null }).spotifyId ?? null;
    const imageUrl = (item as TrackPlays & { imageUrl?: string | null }).imageUrl ?? null;
    const dayPlays = scoringDayPlays(item.dayPlays, referenceDayKey);
    const score = Math.round(item.score * 100) / 100;

    if (i >= 10) {
      return {
        track: item.track,
        artist: item.artist,
        album: item.album,
        spotifyId,
        imageUrl,
        dayPlays,
        score,
        position: null,
        prevPos: null,
        peak: 0,
        weeks: 0,
        numberOnes: 0,
        status: "new" as MyTrlEntryStatus,
        delta: null,
      };
    }

    const position = i + 1;
    const key = trackKey(item.track, item.artist, spotifyId);
    const prev =
      prevMap.get(key) ??
      prevMap.get(trackKey(item.track, item.artist, null)) ??
      null;
    const prevPos = prev?.position ?? null;

    const histStats = aggregateHistoryStats(key, weekday, weekIndex, history, position);
    const peak = prev ? Math.min(position, prev.peak) : Math.min(histStats.peak, position);
    const numberOnes = histStats.numberOnes + (position === 1 ? 1 : 0);
    const prevDays = prev?.weeks ?? 0;

    let status: MyTrlEntryStatus;
    let delta: number | null;
    let weeks: number;

    if (prevPos === null && !histStats.everOnChart) {
      status = "new";
      delta = null;
      weeks = 1;
    } else if (prevPos === null) {
      status = "return";
      delta = null;
      weeks = 1;
    } else if (position < prevPos) {
      status = "up";
      delta = prevPos - position;
      weeks = prevDays + 1;
    } else if (position > prevPos) {
      status = "down";
      delta = position - prevPos;
      weeks = prevDays + 1;
    } else {
      status = "same";
      delta = 0;
      weeks = prevDays + 1;
    }

    return {
      track: item.track,
      artist: item.artist,
      album: item.album,
      spotifyId,
      imageUrl,
      dayPlays,
      score,
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
  const brt = toBrtDate(referenceDay);
  const localDate = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
  const weekIndex = buildWeekIndexFromDate(localDate);
  const weekLabel = buildWeekLabelFromDate(localDate);
  const dateRange = buildMyTrlEditionDate(referenceDay);
  const scoringWindow = buildMyTrlScoringWindow(brtDateKey(referenceDay));
  return { weekIndex, weekLabel, dateRange, scoringWindow };
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

/** Data de referência (YYYY-MM-DD) simulando publicação às 8h BRT, como o cron. */
export function parseMyTrlReferenceDate(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const reference = new Date(`${dateKey}T11:00:00.000Z`);
  if (Number.isNaN(reference.getTime())) return null;
  if (brtDateKey(reference) !== dateKey) return null;
  if (reference.getTime() > Date.now()) return null;
  return reference;
}
