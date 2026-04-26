import type { Chart } from "@/lib/types";

function formatPtDayMonth(date: Date): string {
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${date.getDate()} de ${monthCap}`;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

function weekRange(date: Date): { start: Date; end: Date } {
  const end = new Date(date);
  const day = end.getDay();
  end.setDate(end.getDate() + (day === 0 ? 0 : 7 - day));
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start, end };
}

export function buildWeekLabelFromDate(date: Date): string {
  return `Semana ${isoWeek(date)} - ${isoWeekYear(date)}`;
}

export function buildDateRangeFromDate(date: Date): string {
  const { start, end } = weekRange(date);
  return `de ${formatPtDayMonth(start)} a ${formatPtDayMonth(end)}`;
}

export function buildWeekIndexFromDate(date: Date): number {
  return isoWeekYear(date) * 100 + isoWeek(date);
}

/**
 * Rankings semanais (global/trending) sempre exibem a semana encerrada.
 * Ex.: na terça da semana 18, mostramos resultados da semana 17.
 */
export function getPreviousClosedWeekDate(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - 7);
  return d;
}

export function getRankingWeekReference(now: Date = new Date()) {
  const ref = getPreviousClosedWeekDate(now);
  return {
    weekIndex: buildWeekIndexFromDate(ref),
    weekLabel: buildWeekLabelFromDate(ref),
    dateRange: buildDateRangeFromDate(ref),
  };
}

function normalizeWeekLabel(weekLabel: string): string {
  // Ex.: "Semana 17" -> "Semana 17 - 2026"
  if (/^Semana\s+\d+$/i.test(weekLabel.trim())) {
    return `${weekLabel.trim()} - ${new Date().getFullYear()}`;
  }
  return weekLabel.trim();
}

function parseLegacyEndDate(dateRange: string): Date | null {
  // Ex.: "até 26 Abr, domingo 23:59"
  const m = dateRange.match(/até\s+(\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})/i);
  if (!m) return null;
  const day = Number(m[1]);
  const rawMonth = m[2].toLowerCase().replace(".", "");
  const monthMap: Record<string, number> = {
    jan: 0, fevereiro: 1, fev: 1, mar: 2, abr: 3, maio: 4, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, setembro: 8, out: 9, outubro: 9, nov: 10, dez: 11,
  };
  const month = monthMap[rawMonth];
  if (month === undefined) return null;
  const year = new Date().getFullYear();
  const end = new Date(year, month, day);
  if (Number.isNaN(end.getTime())) return null;
  return end;
}

function normalizeDateRange(dateRange: string): string {
  if (dateRange.trim().startsWith("de ")) return dateRange.trim();
  const legacyEnd = parseLegacyEndDate(dateRange);
  if (!legacyEnd) return dateRange.trim();
  const start = new Date(legacyEnd);
  start.setDate(legacyEnd.getDate() - 6);
  return `de ${formatPtDayMonth(start)} a ${formatPtDayMonth(legacyEnd)}`;
}

export function formatChartPeriod(chart: Pick<Chart, "weekLabel" | "dateRange">): string {
  const weekLabel = normalizeWeekLabel(chart.weekLabel);
  const dateRange = normalizeDateRange(chart.dateRange);
  return `${weekLabel} - ${dateRange}`;
}

