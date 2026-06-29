import {
  buildDateRangeFromDate,
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  prevChartWeekIndex,
} from "@/lib/chart-week";

export type ParadaCadence = "WEEKLY" | "DAILY";

export function toApiCadence(cadence: ParadaCadence): "weekly" | "daily" {
  return cadence === "DAILY" ? "daily" : "weekly";
}

export function parseCadenceInput(value: unknown): ParadaCadence | null {
  if (value === "daily" || value === "DAILY") return "DAILY";
  if (value === "weekly" || value === "WEEKLY") return "WEEKLY";
  return null;
}

/** Índice diário codificado como YYYYMMDD (8 dígitos, distinto do índice semanal). */
export function buildDayIndexFromDate(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return Number(`${y}${m}${d}`);
}

export function parseDayIndexToDate(dayIndex: number): Date {
  const s = String(dayIndex).padStart(8, "0");
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

export function buildDayLabelFromDate(date: Date): string {
  const month = date.toLocaleDateString("pt-BR", { month: "long" });
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${date.getDate()} de ${monthCap} de ${date.getFullYear()}`;
}

export function buildDayDateRangeFromDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function prevChartDayIndex(dayIndex: number): number {
  const date = parseDayIndexToDate(dayIndex);
  date.setDate(date.getDate() - 1);
  return buildDayIndexFromDate(date);
}

export function isDailyChartIndex(periodIndex: number): boolean {
  return periodIndex >= 1_000_000;
}

/** Semanal = YYYYWW (< 1_000_000); diário = YYYYMMDD (>= 1_000_000). */
export function inferCadenceFromWeekIndex(weekIndex: number): ParadaCadence {
  return isDailyChartIndex(weekIndex) ? "DAILY" : "WEEKLY";
}

function weekSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
  return d;
}

export function buildPeriodFromDate(date: Date, cadence: ParadaCadence) {
  if (cadence === "DAILY") {
    return {
      periodIndex: buildDayIndexFromDate(date),
      periodLabel: buildDayLabelFromDate(date),
      dateRange: buildDayDateRangeFromDate(date),
      publishedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    };
  }
  return {
    periodIndex: buildWeekIndexFromDate(date),
    periodLabel: buildWeekLabelFromDate(date),
    dateRange: buildDateRangeFromDate(date),
    publishedAt: weekSunday(date),
  };
}

export function prevPeriodIndex(periodIndex: number, cadence: ParadaCadence): number {
  return cadence === "DAILY" ? prevChartDayIndex(periodIndex) : prevChartWeekIndex(periodIndex);
}

export function computeStreakForCadence(periodIndexes: number[], cadence: ParadaCadence): number {
  if (periodIndexes.length === 0) return 0;
  const sortedUnique = [...new Set(periodIndexes)].sort((a, b) => b - a);
  let streak = 1;
  let cursor = sortedUnique[0];
  for (let i = 1; i < sortedUnique.length; i++) {
    const expected = prevPeriodIndex(cursor, cadence);
    if (sortedUnique[i] !== expected) break;
    streak += 1;
    cursor = sortedUnique[i];
  }
  return streak;
}

export function formatDayPickerLabel(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Rótulos de estatísticas da parada conforme cadência (diária vs semanal). */
export function chartStatsLabels(isDaily: boolean) {
  return {
    prevPeriodShort: isDaily ? "Anterior" : "Semana ant.",
    tenureShort: isDaily ? "Dias" : "Sem.",
    tenurePill: isDaily ? "DIA" : "SEM",
    tenureSuffix: isDaily ? "dias" : "sem.",
    noDropouts: isDaily
      ? "Nenhuma saída neste dia — primeira parada ou todas as músicas permaneceram."
      : "Nenhuma saída nesta semana — primeira parada ou todas as músicas permaneceram.",
    overlapLoading: isDaily ? "Calculando afinidade do dia..." : "Calculando afinidade da semana...",
    overlapEmpty: isDaily ? "Nenhuma afinidade encontrada neste dia." : "Nenhuma afinidade encontrada nesta semana.",
  };
}

/** Tempo na parada por extenso (ex.: "3 semanas", "1 dia"). */
export function formatTenureProse(weeks: number, isDaily: boolean): string {
  if (isDaily) return weeks === 1 ? "1 dia" : `${weeks} dias`;
  return weeks === 1 ? "1 semana" : `${weeks} semanas`;
}

/** Variação de posição por extenso (ex.: "+1", "Nova", "—"). */
export function formatMovementProse(
  status: "new" | "return" | "up" | "down" | "same",
  delta?: number | null,
): string {
  switch (status) {
    case "new":
      return "Nova";
    case "return":
      return "Retorno";
    case "up":
      return `+${delta ?? 0}`;
    case "down":
      return `-${Math.abs(delta ?? 0)}`;
    default:
      return "—";
  }
}
