import { prevChartWeekIndex } from "@/lib/chart-week";

/** Primeira semana ISO de 2026 — corte do Global 100 (dados anteriores não entram). */
export const GLOBAL_RANKING_FIRST_WEEK_INDEX = 202601;

export function isGlobalRankingWeek(weekIndex: number): boolean {
  return weekIndex >= GLOBAL_RANKING_FIRST_WEEK_INDEX;
}

/** Semana anterior dentro da era Global 100, ou `null` na primeira semana de 2026. */
export function globalPrevWeekIndex(weekIndex: number): number | null {
  if (!isGlobalRankingWeek(weekIndex)) return null;
  const prev = prevChartWeekIndex(weekIndex);
  return prev >= GLOBAL_RANKING_FIRST_WEEK_INDEX ? prev : null;
}
