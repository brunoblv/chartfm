import type { ParadaCadence } from "@/lib/chart-cadence";

/** Parada principal: #1 = 1000 pts, curva decrescente até #100 = 10 pts. */
export type ParadaScoringTier = "primary" | "secondary";

export const PRIMARY_POINTS_TOP = 1000;
export const PRIMARY_POINTS_BOTTOM = 10;
export const PRIMARY_POINTS_DECAY_EXPONENT = 1.5;

/** Parada secundária diária: mesma curva da principal, escala 100→1. */
export const SECONDARY_DAILY_POINTS_TOP = 100;
export const SECONDARY_DAILY_POINTS_BOTTOM = 1;

const PRIMARY_TOP_THREE = { 1: 1000, 2: 900, 3: 850 } as const;
const SECONDARY_DAILY_TOP_THREE = { 1: 100, 2: 90, 3: 85 } as const;

function calcularPontosDecrescente(
  posicao: number,
  topThree: { 1: number; 2: number; 3: number },
  bottom: number,
  maxPos = 100,
  p = PRIMARY_POINTS_DECAY_EXPONENT,
): number {
  const pos = Math.min(Math.max(1, Math.floor(posicao)), maxPos);
  if (pos <= 3) return topThree[pos as 1 | 2 | 3];
  const raw = bottom + (topThree[3] - bottom) * ((maxPos - pos) / (maxPos - 3)) ** p;
  return Math.ceil(Math.ceil(raw * 10) / 10);
}

/**
 * Pontuação de parada principal por posição (1–100).
 * Top 3 fixo; demais posições seguem curva com expoente p, arredondadas para cima.
 */
export function calcularPontosPrimary(posicao: number, p = PRIMARY_POINTS_DECAY_EXPONENT): number {
  return calcularPontosDecrescente(posicao, PRIMARY_TOP_THREE, PRIMARY_POINTS_BOTTOM, 100, p);
}

/** Parada secundária diária: #1 = 100 pts, mesma curva decrescente até #100 = 1 pt. */
export function calcularPontosSecondaryDaily(
  posicao: number,
  p = PRIMARY_POINTS_DECAY_EXPONENT,
): number {
  return calcularPontosDecrescente(
    posicao,
    SECONDARY_DAILY_TOP_THREE,
    SECONDARY_DAILY_POINTS_BOTTOM,
    100,
    p,
  );
}

export function primaryPointsRangeLabel(): string {
  return `${PRIMARY_POINTS_TOP}→${PRIMARY_POINTS_BOTTOM} pt`;
}

export const MAX_PARADAS_PER_USER = 2;

export function normalizeCadenceForScoring(cadence?: string | null): ParadaCadence {
  if (cadence === "daily" || cadence === "DAILY") return "DAILY";
  return "WEEKLY";
}

export function secondaryPointsMax(cadence?: string | null): number {
  return normalizeCadenceForScoring(cadence) === "DAILY"
    ? SECONDARY_DAILY_POINTS_TOP
    : PRIMARY_POINTS_TOP;
}

export function secondaryPointsRangeLabel(cadence?: string | null): string {
  return normalizeCadenceForScoring(cadence) === "DAILY"
    ? `${SECONDARY_DAILY_POINTS_TOP}→${SECONDARY_DAILY_POINTS_BOTTOM} pt`
    : primaryPointsRangeLabel();
}

/**
 * Parada secundária: semanal usa a mesma escala da principal (1000→10);
 * diária usa a mesma curva decrescente em escala 100→1.
 */
export function pointsForSecondaryPosition(
  position: number,
  _chartSize?: number,
  cadence?: string | null,
): number {
  if (normalizeCadenceForScoring(cadence) === "DAILY") {
    return calcularPontosSecondaryDaily(position);
  }
  return calcularPontosPrimary(position);
}

export function pointsForChartPosition(
  position: number,
  tier: ParadaScoringTier,
  chartSize?: number,
  cadence?: string | null,
): number {
  if (tier === "primary") return calcularPontosPrimary(position);
  return pointsForSecondaryPosition(position, chartSize, cadence);
}

export function scoringTierFromPrimary(isPrimary: boolean): ParadaScoringTier {
  return isPrimary ? "primary" : "secondary";
}
