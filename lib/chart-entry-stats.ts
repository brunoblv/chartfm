import type { Prisma, PrismaClient } from "@prisma/client";

export type ComputedEntryStats = {
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
};

type EntryLike = {
  songId: string;
  position: number;
};

type AnyChart = {
  weekIndex: number;
  entries: EntryLike[];
};

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28)));
}

export function prevWeekIndex(index: number): number {
  const year = Math.floor(index / 100);
  const week = index % 100;
  if (week > 1) return year * 100 + (week - 1);
  const prevYear = year - 1;
  return prevYear * 100 + isoWeeksInYear(prevYear);
}

export function applyComputedEntryStatsToCharts<TChart extends AnyChart>(
  charts: TChart[],
): Array<Omit<TChart, "entries"> & { entries: Array<TChart["entries"][number] & ComputedEntryStats> }> {
  const sorted = [...charts].sort((a, b) => a.weekIndex - b.weekIndex);
  const history = new Map<string, { weeks: number; peak: number }>();
  const entriesByWeek = new Map<number, Map<string, EntryLike>>();
  const computedByChart = new Map<TChart, Array<TChart["entries"][number] & ComputedEntryStats>>();

  for (const chart of sorted) {
    const previousWeekEntries = entriesByWeek.get(prevWeekIndex(chart.weekIndex));
    const computedEntries = chart.entries.map((entry) => {
      const previous = previousWeekEntries?.get(entry.songId) ?? null;
      const previousHistory = history.get(entry.songId) ?? null;
      const delta = previous ? previous.position - entry.position : null;
      const prevPos = previous?.position ?? null;
      const status: ComputedEntryStats["status"] = previous
        ? delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down"
        : previousHistory
          ? "return"
          : "new";

      return {
        ...entry,
        status,
        delta,
        prevPos,
        peak: Math.min(previousHistory?.peak ?? entry.position, entry.position),
        weeks: (previousHistory?.weeks ?? 0) + 1,
      };
    });

    computedByChart.set(chart, computedEntries);

    const currentWeekEntries = new Map<string, EntryLike>();
    for (const entry of computedEntries) {
      currentWeekEntries.set(entry.songId, entry);
      history.set(entry.songId, { weeks: entry.weeks, peak: entry.peak });
    }
    entriesByWeek.set(chart.weekIndex, currentWeekEntries);
  }

  return charts.map((chart) => ({ ...chart, entries: computedByChart.get(chart) ?? [] }));
}

export async function recomputePersistedChartEntryStats(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
  fromWeekIndex?: number,
) {
  const charts = await client.chart.findMany({
    where: { userId },
    orderBy: { weekIndex: "asc" },
    select: {
      id: true,
      weekIndex: true,
      entries: {
        orderBy: { position: "asc" },
        select: { id: true, songId: true, position: true },
      },
    },
  });

  const computedCharts = applyComputedEntryStatsToCharts(charts);
  const updates = computedCharts.flatMap((chart) =>
    chart.entries
      .filter(() => fromWeekIndex === undefined || chart.weekIndex >= fromWeekIndex)
      .map((entry) =>
        client.chartEntry.update({
          where: { id: entry.id },
          data: {
            status: entry.status,
            delta: entry.delta,
            prevPos: entry.prevPos,
            peak: entry.peak,
            weeks: entry.weeks,
          },
        }),
      ),
  );

  await Promise.all(updates);
}
