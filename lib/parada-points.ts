import type { ParadaCadence } from "@/lib/chart-cadence";

/** Parada principal: #1 = 100 pts, #100 = 1 pt (101 - posição). */
export type ParadaScoringTier = "primary" | "secondary";

export const MAX_PARADAS_PER_USER = 2;

export const SECONDARY_POINTS_MAX_WEEKLY = 30;
export const SECONDARY_POINTS_MAX_DAILY = 6;
export const SECONDARY_POINTS_MIN = 1;

export function normalizeCadenceForScoring(cadence?: string | null): ParadaCadence {
  if (cadence === "daily" || cadence === "DAILY") return "DAILY";
  return "WEEKLY";
}

export function secondaryPointsMax(cadence?: string | null): number {
  return normalizeCadenceForScoring(cadence) === "DAILY"
    ? SECONDARY_POINTS_MAX_DAILY
    : SECONDARY_POINTS_MAX_WEEKLY;
}

export function secondaryPointsRangeLabel(cadence?: string | null): string {
  return `${secondaryPointsMax(cadence)}→1 pt`;
}

/**
 * Parada secundária: escala linear do topo até 1 pt conforme o tamanho da parada.
 * Diária: #1 = 6 pts; semanal: #1 = 30 pts; última posição = 1 pt em ambos.
 */
export function pointsForSecondaryPosition(
  position: number,
  chartSize: number,
  cadence?: string | null,
): number {
  const maxPts = secondaryPointsMax(cadence);
  const n = Math.max(1, Math.floor(chartSize));
  const pos = Math.min(Math.max(1, Math.floor(position)), n);
  if (n <= 1) return maxPts;
  const span = maxPts - SECONDARY_POINTS_MIN;
  const raw = maxPts - ((pos - 1) * span) / (n - 1);
  return Math.max(SECONDARY_POINTS_MIN, Math.round(raw));
}

export function pointsForChartPosition(
  position: number,
  tier: ParadaScoringTier,
  chartSize?: number,
  cadence?: string | null,
): number {
  if (tier === "primary") return 101 - position;
  const size = chartSize ?? position;
  return pointsForSecondaryPosition(position, size, cadence);
}

export function scoringTierFromPrimary(isPrimary: boolean): ParadaScoringTier {
  return isPrimary ? "primary" : "secondary";
}
