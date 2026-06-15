import type { MyTrlChartEntry, MyTrlEntryStatus } from "./mytrl-chart-engine";
import { toBrtDate } from "./mytrl-chart-engine";

export type MyTrlEditionRow = {
  weekday: number;
  weekIndex: number;
  computedAt: Date;
  entries: MyTrlChartEntry[];
};

/** Índice do dia da edição (YYYYMMDD em BRT), igual às paradas diárias. */
export function myTrlDayIndexFromDate(date: Date): number {
  const brt = toBrtDate(date);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth() + 1;
  const d = brt.getUTCDate();
  return y * 10_000 + m * 100 + d;
}

function parseDayIndex(dayIndex: number): Date {
  const y = Math.floor(dayIndex / 10_000);
  const m = Math.floor((dayIndex % 10_000) / 100);
  const d = dayIndex % 100;
  return new Date(Date.UTC(y, m - 1, d));
}

/** Dia útil anterior à publicação (pula fim de semana). */
export function prevMyTrlPublicationDayIndex(dayIndex: number): number | null {
  const date = parseDayIndex(dayIndex);
  date.setUTCDate(date.getUTCDate() - 1);

  for (let i = 0; i < 3; i++) {
    const wd = date.getUTCDay();
    if (wd >= 1 && wd <= 5) {
      return myTrlDayIndexFromDate(date);
    }
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return null;
}

export function myTrlEditionStorageKey(weekday: number, weekIndex: number): string {
  return `${weekday}:${weekIndex}`;
}

function trackKeys(track: string, artist: string, spotifyId: string | null): string[] {
  const keys = [`na:${track.toLowerCase()}|||${artist.toLowerCase()}`];
  if (spotifyId) keys.unshift(`sp:${spotifyId}`);
  return keys;
}

function entriesMatch(a: MyTrlChartEntry, track: string, artist: string, spotifyId: string | null): boolean {
  const aKeys = new Set(trackKeys(a.track, a.artist, a.spotifyId));
  return trackKeys(track, artist, spotifyId).some((k) => aKeys.has(k));
}

function findEntry(
  list: MyTrlChartEntry[],
  track: string,
  artist: string,
  spotifyId: string | null,
): MyTrlChartEntry | null {
  return list.find((e) => entriesMatch(e, track, artist, spotifyId)) ?? null;
}

/**
 * Mesma lógica da exibição de paradas diárias (GET /api/charts/[id]):
 * - prevPos: só a edição imediatamente anterior (dia útil)
 * - dias (weeks): total de aparições até esta edição
 * - pico / #1s: acumulado até esta edição
 */
export function applyMyTrlStatsToEntries(
  dayIndex: number,
  entries: MyTrlChartEntry[],
  editionsByDay: Map<number, MyTrlChartEntry[]>,
  sortedDayIndexes: number[],
): MyTrlChartEntry[] {
  const prevPubDay = prevMyTrlPublicationDayIndex(dayIndex);
  const prevEntries = prevPubDay != null ? (editionsByDay.get(prevPubDay) ?? []) : [];

  return entries.map((entry, i) => {
    const position = entry.position || i + 1;
    const prevEntry = findEntry(prevEntries, entry.track, entry.artist, entry.spotifyId);
    const prevPos = prevEntry?.position ?? null;

    let weeks = 0;
    let peak = position;
    let numberOnes = 0;
    let hasOlder = false;

    for (const d of sortedDayIndexes) {
      if (d > dayIndex) break;
      const list = d === dayIndex ? entries : (editionsByDay.get(d) ?? []);
      const past = findEntry(list, entry.track, entry.artist, entry.spotifyId);
      if (!past) continue;

      weeks += 1;
      peak = Math.min(peak, past.position);
      if (past.position === 1) numberOnes += 1;

      if (prevPubDay != null && d < prevPubDay) hasOlder = true;
    }

    let status: MyTrlEntryStatus;
    let delta: number | null;

    if (prevPos === null) {
      status = hasOlder ? "return" : "new";
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

    return {
      ...entry,
      position,
      prevPos,
      peak,
      weeks: weeks || 1,
      numberOnes,
      status,
      delta,
    };
  });
}

export function recomputeMyTrlEditionStats(rows: MyTrlEditionRow[]): Map<string, MyTrlChartEntry[]> {
  const editionsByDay = new Map<number, MyTrlChartEntry[]>();
  const rowByDay = new Map<number, MyTrlEditionRow>();
  const dayIndexes: number[] = [];

  for (const row of rows) {
    const dayIndex = myTrlDayIndexFromDate(row.computedAt);
    editionsByDay.set(dayIndex, row.entries);
    rowByDay.set(dayIndex, row);
    dayIndexes.push(dayIndex);
  }

  const sortedDayIndexes = [...new Set(dayIndexes)].sort((a, b) => a - b);
  const result = new Map<string, MyTrlChartEntry[]>();

  for (const dayIndex of sortedDayIndexes) {
    const row = rowByDay.get(dayIndex);
    const entries = editionsByDay.get(dayIndex);
    if (!row || !entries) continue;

    const computed = applyMyTrlStatsToEntries(dayIndex, entries, editionsByDay, sortedDayIndexes);
    result.set(myTrlEditionStorageKey(row.weekday, row.weekIndex), computed);
  }

  return result;
}
