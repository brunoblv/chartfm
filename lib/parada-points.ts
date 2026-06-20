import type { ParadaCadence } from "@/lib/chart-cadence";

/** Parada principal: #1 = 1000 pts, curva decrescente até #100 = 10 pts. */
export type ParadaScoringTier = "primary" | "secondary";

export const PRIMARY_POINTS_TOP = 1000;
export const PRIMARY_POINTS_DECAY_EXPONENT = 1.5;

/**
 * Pontuação de parada principal por posição (1–100).
 * Top 3 fixo; demais posições seguem curva com expoente p, arredondadas para cima.
 */
export function calcularPontosPrimary(posicao: number, p = PRIMARY_POINTS_DECAY_EXPONENT): number {
  const pos = Math.min(Math.max(1, Math.floor(posicao)), 100);
  if (pos <= 3) {
    return { 1: 1000, 2: 900, 3: 850 }[pos]!;
  }
  const raw = 10 + (850 - 10) * ((100 - pos) / 97) ** p;
  // Curva com 1 casa decimal arredondada para cima; persistido como Int no banco.
  return Math.ceil(Math.ceil(raw * 10) / 10);
}

export function primaryPointsRangeLabel(): string {
  return `${PRIMARY_POINTS_TOP}→10 pt`;
}

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
  if (tier === "primary") return calcularPontosPrimary(position);
  const size = chartSize ?? position;
  return pointsForSecondaryPosition(position, size, cadence);
}

export function scoringTierFromPrimary(isPrimary: boolean): ParadaScoringTier {
  return isPrimary ? "primary" : "secondary";
}
