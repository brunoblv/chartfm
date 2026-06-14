import { pointsForPosition } from "@/lib/chart-page-common";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";

type EntryPointsInput = {
  position: number;
  points: number;
  chart?: {
    maxItems?: number;
    entryCount?: number;
    parada?: { isPrimary: boolean; cadence?: string | null };
  };
};

/**
 * Pontos de uma entrada: usa o valor persistido em ChartEntry.points (snapshot na publicação).
 * Só recalcula quando points = 0 (dados legados antes da persistência).
 */
export function resolvedChartEntryPoints(entry: EntryPointsInput): number {
  if (entry.points > 0) return entry.points;

  const parada = entry.chart?.parada;
  if (parada) {
    const tier = scoringTierFromPrimary(parada.isPrimary);
    const chartSize = entry.chart?.entryCount ?? entry.chart?.maxItems ?? entry.position;
    return pointsForChartPosition(entry.position, tier, chartSize, parada.cadence);
  }

  return pointsForPosition(entry.position);
}
