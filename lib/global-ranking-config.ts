import { prevChartWeekIndex } from "@/lib/chart-week";

/** Primeira semana ISO de 2026 — corte do Global 100 (dados anteriores não entram). */
export const GLOBAL_RANKING_FIRST_WEEK_INDEX = 202601;

/**
 * Snapshots congelados antes desta semana mantêm o ranking calculado com a curva legada.
 * A partir da próxima semana global, novos snapshots usam os pontos persistidos (calcularPontos).
 * Definido como a semana de ranking corrente no momento da migração; snapshots já existentes
 * no banco não são recalculados.
 */
export const GLOBAL_STORED_POINTS_FROM_WEEK_INDEX = 202625;

export function isGlobalRankingWeek(weekIndex: number): boolean {
  return weekIndex >= GLOBAL_RANKING_FIRST_WEEK_INDEX;
}

/** Semana anterior dentro da era Global 100, ou `null` na primeira semana de 2026. */
export function globalPrevWeekIndex(weekIndex: number): number | null {
  if (!isGlobalRankingWeek(weekIndex)) return null;
  const prev = prevChartWeekIndex(weekIndex);
  return prev >= GLOBAL_RANKING_FIRST_WEEK_INDEX ? prev : null;
}
