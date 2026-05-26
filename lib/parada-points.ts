/** Parada principal: #1 = 100 pts, #100 = 1 pt (101 - posição). */
export type ParadaScoringTier = "primary" | "secondary";

export const MAX_PARADAS_PER_USER = 2;

export const SECONDARY_POINTS_MAX = 20;
export const SECONDARY_POINTS_MIN = 1;

/**
 * Parada secundária: #1 = 20 pts, última posição = 1 pt, escala linear conforme o tamanho da parada da semana.
 * Ex.: 20 músicas → #1=20, #20=1; 50 músicas → #1=20, #50=1.
 */
export function pointsForSecondaryPosition(position: number, chartSize: number): number {
  const n = Math.max(1, Math.floor(chartSize));
  const pos = Math.min(Math.max(1, Math.floor(position)), n);
  if (n <= 1) return SECONDARY_POINTS_MAX;
  const span = SECONDARY_POINTS_MAX - SECONDARY_POINTS_MIN;
  const raw = SECONDARY_POINTS_MAX - ((pos - 1) * span) / (n - 1);
  return Math.max(SECONDARY_POINTS_MIN, Math.round(raw));
}

export function pointsForChartPosition(
  position: number,
  tier: ParadaScoringTier,
  chartSize?: number,
): number {
  if (tier === "primary") return 101 - position;
  const size = chartSize ?? position;
  return pointsForSecondaryPosition(position, size);
}

export function scoringTierFromPrimary(isPrimary: boolean): ParadaScoringTier {
  return isPrimary ? "primary" : "secondary";
}
