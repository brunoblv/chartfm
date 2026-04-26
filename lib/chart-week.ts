import type { Chart } from "@/lib/types";

function formatDatePtBr(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

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
  return `${formatDatePtBr(start)} a ${formatDatePtBr(end)}`;
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
  const trimmed = dateRange.trim();
  if (/^\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("de ")) return trimmed;
  const legacyEnd = parseLegacyEndDate(dateRange);
  if (!legacyEnd) return trimmed;
  const start = new Date(legacyEnd);
  start.setDate(legacyEnd.getDate() - 6);
  return `de ${formatPtDayMonth(start)} a ${formatPtDayMonth(legacyEnd)}`;
}

function monthNameToNumber(rawMonth: string): number | null {
  const key = rawMonth.toLowerCase().replace(".", "");
  const monthMap: Record<string, number> = {
    jan: 0, janeiro: 0,
    fev: 1, fevereiro: 1,
    mar: 2, março: 2,
    abr: 3, abril: 3,
    mai: 4, maio: 4,
    jun: 5, junho: 5,
    jul: 6, julho: 6,
    ago: 7, agosto: 7,
    set: 8, setembro: 8,
    out: 9, outubro: 9,
    nov: 10, novembro: 10,
    dez: 11, dezembro: 11,
  };
  return monthMap[key] ?? null;
}

function parseDateRangeToDates(dateRange: string, fallbackYear: number): { start: Date; end: Date } | null {
  const trimmed = dateRange.trim();
  const numericMatch = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})$/,
  );
  if (numericMatch) {
    const [, sD, sM, sY, eD, eM, eY] = numericMatch;
    const start = new Date(Number(sY), Number(sM) - 1, Number(sD));
    const end = new Date(Number(eY), Number(eM) - 1, Number(eD));
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { start, end };
    }
  }

  const textMatch = trimmed.match(/^de\s+(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]{3,})\s+a\s+(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]{3,})$/i);
  if (textMatch) {
    const [, sDay, sMonthRaw, eDay, eMonthRaw] = textMatch;
    const sMonth = monthNameToNumber(sMonthRaw);
    const eMonth = monthNameToNumber(eMonthRaw);
    if (sMonth !== null && eMonth !== null) {
      const start = new Date(fallbackYear, sMonth, Number(sDay));
      const end = new Date(fallbackYear, eMonth, Number(eDay));
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        return { start, end };
      }
    }
  }

  return null;
}

function parseWeekYear(weekLabel: string): number {
  const m = weekLabel.match(/(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function parseWeekNumber(weekLabel: string): number | null {
  const m = weekLabel.match(/Semana\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function formatChartPeriod(chart: Pick<Chart, "weekLabel" | "dateRange">): string {
  const weekLabel = normalizeWeekLabel(chart.weekLabel);
  const dateRange = normalizeDateRange(chart.dateRange);
  const year = parseWeekYear(weekLabel);
  const weekNumber = parseWeekNumber(weekLabel);
  const parsed = parseDateRangeToDates(dateRange, year);
  const weekText = weekNumber ? `Semana ${weekNumber}, ${year}` : weekLabel.replace("-", ",");
  if (parsed) {
    return `${formatDatePtBr(parsed.start)} a ${formatDatePtBr(parsed.end)} - ${weekText}`;
  }
  return `${dateRange} - ${weekText}`;
}

