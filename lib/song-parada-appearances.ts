import { formatChartPeriod } from "@/lib/chart-week";
import { resolvedChartEntryPoints } from "@/lib/chart-entry-points";

export type SongAppearanceRow = {
  chartId: string;
  position: number;
  dateRange: string;
  weekOfYear: number;
  year: number;
};

export type SongParadaUserStats = {
  appearances: number;
  bestPosition: number;
  points: number;
  number1s: number;
};

export type SongParadaAppearanceGroup = {
  paradaId: string;
  paradaName: string;
  isPrimary: boolean;
  appearances: SongAppearanceRow[];
  stats: SongParadaUserStats;
};

type ChartEntryForAppearances = {
  position: number;
  points: number;
  chart: {
    id: string;
    weekIndex: number;
    weekLabel: string;
    dateRange: string;
    maxItems: number;
    entryCount: number;
    parada: {
      id: string;
      name: string;
      isPrimary: boolean;
      sortOrder: number;
      cadence: string;
    };
  };
};

function chartDateRangeOnly(
  chart: { weekLabel: string; dateRange: string },
  locale: "pt-BR" | "en",
): string {
  const full = formatChartPeriod(chart, locale);
  const marker = " - ";
  const cut = full.lastIndexOf(marker);
  return cut >= 0 ? full.slice(0, cut) : full;
}

function entryPoints(entry: ChartEntryForAppearances): number {
  return resolvedChartEntryPoints(entry);
}

function buildStats(entries: ChartEntryForAppearances[]): SongParadaUserStats {
  if (entries.length === 0) {
    return { appearances: 0, bestPosition: 9999, points: 0, number1s: 0 };
  }
  return {
    appearances: entries.length,
    bestPosition: Math.min(...entries.map((e) => e.position)),
    points: entries.reduce((sum, e) => sum + entryPoints(e), 0),
    number1s: entries.filter((e) => e.position === 1).length,
  };
}

export function buildSongParadaAppearanceGroups(
  entries: ChartEntryForAppearances[],
  userParadas: { id: string; name: string; isPrimary: boolean; sortOrder: number }[] = [],
  locale: "pt-BR" | "en" = "pt-BR",
): SongParadaAppearanceGroup[] {
  const byParada = new Map<string, ChartEntryForAppearances[]>();
  for (const entry of entries) {
    const paradaId = entry.chart.parada.id;
    const list = byParada.get(paradaId) ?? [];
    list.push(entry);
    byParada.set(paradaId, list);
  }

  const paradaMeta = new Map<string, { name: string; isPrimary: boolean; sortOrder: number }>();
  for (const parada of userParadas) {
    paradaMeta.set(parada.id, {
      name: parada.name,
      isPrimary: parada.isPrimary,
      sortOrder: parada.sortOrder,
    });
  }
  for (const entry of entries) {
    const parada = entry.chart.parada;
    if (!paradaMeta.has(parada.id)) {
      paradaMeta.set(parada.id, {
        name: parada.name,
        isPrimary: parada.isPrimary,
        sortOrder: parada.sortOrder,
      });
    }
  }

  const paradaIds = userParadas.length > 0 ? userParadas.map((p) => p.id) : [...paradaMeta.keys()];

  return paradaIds
    .map((paradaId) => {
      const meta = paradaMeta.get(paradaId);
      if (!meta) return null;
      const paradaEntries = byParada.get(paradaId) ?? [];
      const appearances = [...paradaEntries]
        .sort((a, b) => a.chart.weekIndex - b.chart.weekIndex)
        .map((e) => ({
          chartId: e.chart.id,
          position: e.position,
          dateRange: chartDateRangeOnly({ weekLabel: e.chart.weekLabel, dateRange: e.chart.dateRange }, locale),
          weekOfYear: e.chart.weekIndex % 100,
          year: Math.floor(e.chart.weekIndex / 100),
        }));
      return {
        paradaId,
        paradaName: meta.name,
        isPrimary: meta.isPrimary,
        sortOrder: meta.sortOrder,
        appearances,
        stats: buildStats(paradaEntries),
      };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    })
    .map(({ sortOrder, ...group }) => group);
}
