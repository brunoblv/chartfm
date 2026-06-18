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

/** Edição publicada imediatamente anterior na timeline (mesma ordem das setas ←). */
export function prevPublishedDayIndex(dayIndex: number, sortedDayIndexes: number[]): number | null {
  const i = sortedDayIndexes.indexOf(dayIndex);
  if (i <= 0) return null;
  return sortedDayIndexes[i - 1] ?? null;
}

export function sortEditionsChronologically<T extends { computedAt: Date }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => myTrlDayIndexFromDate(a.computedAt) - myTrlDayIndexFromDate(b.computedAt),
  );
}

export function myTrlEditionStorageKey(weekday: number, weekIndex: number): string {
  return `${weekday}:${weekIndex}`;
}

function entriesMatch(a: MyTrlChartEntry, track: string, artist: string, spotifyId: string | null): boolean {
  const aKeys = new Set([
    `na:${a.track.toLowerCase()}|||${a.artist.toLowerCase()}`,
    ...(a.spotifyId ? [`sp:${a.spotifyId}`] : []),
  ]);
  const bKeys = [
    `na:${track.toLowerCase()}|||${artist.toLowerCase()}`,
    ...(spotifyId ? [`sp:${spotifyId}`] : []),
  ];
  return bKeys.some((k) => aKeys.has(k));
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
 * Estatísticas na ordem cronológica (mais antiga → mais recente):
 * - Ao ver a edição de hoje, "Anterior" = edição imediatamente anterior publicada (←)
 * - "Dias" / pico / #1s = acumulado desde a primeira edição até a atual
 */
export function applyMyTrlStatsToEntries(
  dayIndex: number,
  entries: MyTrlChartEntry[],
  editionsByDay: Map<number, MyTrlChartEntry[]>,
  sortedDayIndexes: number[],
): MyTrlChartEntry[] {
  const prevPubDay = prevPublishedDayIndex(dayIndex, sortedDayIndexes);
  const prevEntries = prevPubDay != null ? (editionsByDay.get(prevPubDay) ?? []) : [];

  return entries.map((entry) => {
    if (entry.position == null) return entry;

    const position = entry.position;
    const prevEntry = findEntry(
      prevEntries.filter((e) => e.position != null),
      entry.track,
      entry.artist,
      entry.spotifyId,
    );
    const prevPos = prevEntry?.position ?? null;

    let weeks = 0;
    let peak = position;
    let numberOnes = 0;

    for (const d of sortedDayIndexes) {
      if (d > dayIndex) break;
      const list = d === dayIndex ? entries : (editionsByDay.get(d) ?? []);
      const past = findEntry(list, entry.track, entry.artist, entry.spotifyId);
      if (!past || past.position == null) continue;

      weeks += 1;
      peak = Math.min(peak, past.position);
      if (past.position === 1) numberOnes += 1;
    }

    let hasOlder = false;
    if (prevPos === null) {
      for (const d of sortedDayIndexes) {
        if (d >= dayIndex) break;
        if (findEntry(editionsByDay.get(d) ?? [], entry.track, entry.artist, entry.spotifyId)) {
          hasOlder = true;
          break;
        }
      }
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
  const sortedRows = sortEditionsChronologically(rows);
  const editionsByDay = new Map<number, MyTrlChartEntry[]>();
  const rowByDay = new Map<number, MyTrlEditionRow>();
  const sortedDayIndexes: number[] = [];

  for (const row of sortedRows) {
    const dayIndex = myTrlDayIndexFromDate(row.computedAt);
    editionsByDay.set(dayIndex, row.entries);
    rowByDay.set(dayIndex, row);
    sortedDayIndexes.push(dayIndex);
  }

  const uniqueSortedDays = [...new Set(sortedDayIndexes)].sort((a, b) => a - b);
  const result = new Map<string, MyTrlChartEntry[]>();

  for (const dayIndex of uniqueSortedDays) {
    const row = rowByDay.get(dayIndex);
    const entries = editionsByDay.get(dayIndex);
    if (!row || !entries) continue;

    const computed = applyMyTrlStatsToEntries(dayIndex, entries, editionsByDay, uniqueSortedDays);
    result.set(myTrlEditionStorageKey(row.weekday, row.weekIndex), computed);
  }

  return result;
}
