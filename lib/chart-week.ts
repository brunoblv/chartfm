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

/** Segunda a domingo (domingo = fim da semana), mesmo critério do rótulo da parada. */
export function getChartWeekRange(date: Date): { start: Date; end: Date } {
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
  const { start, end } = getChartWeekRange(date);
  return `${formatDatePtBr(start)} a ${formatDatePtBr(end)}`;
}

export function buildWeekIndexFromDate(date: Date): number {
  return isoWeekYear(date) * 100 + isoWeek(date);
}

/** Semana ISO da data 28/12 (última semana ISO do ano civil). */
export function isoWeeksInYear(year: number): number {
  // Usar componentes locais (como buildWeekIndexFromDate) — Date.UTC aqui desloca o dia
  // em fusos à oeste de Greenwich e subconta anos com 53 semanas ISO (ex.: 2020 → 52 em vez de 53).
  return isoWeek(new Date(year, 11, 28));
}

/** `weekIndex` codificado como `ano*100 + semanaISO` (igual ao banco). Semana imediatamente anterior. */
export function prevChartWeekIndex(weekIndex: number): number {
  const year = Math.floor(weekIndex / 100);
  const week = weekIndex % 100;
  if (week > 1) return year * 100 + (week - 1);
  const prevYear = year - 1;
  return prevYear * 100 + isoWeeksInYear(prevYear);
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

/**
 * A parada global e as paradas de comunidade atualizam na terça-feira às 6h BRT.
 * Antes do corte: exibe a semana anterior à semana que acabou de fechar (14 dias atrás).
 * Depois do corte: exibe a semana que acabou de fechar (7 dias atrás).
 *
 * Sempre espera um timestamp UTC padrão (new Date()). Faz a conversão para BRT internamente.
 */
export function getRankingWeekReference(nowUtc: Date = new Date()) {
  const brt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const day = brt.getUTCDay();    // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  const hour = brt.getUTCHours();
  // Corte: terça-feira (2) às 6h BRT, ou qualquer dia posterior dentro da semana
  const cutoffPassed =
    (day === 2 && hour >= 6) ||
    (day >= 3 && day <= 6) ||
    day === 0;
  const daysBack = cutoffPassed ? 7 : 14;
  const ref = new Date(nowUtc.getTime() - daysBack * 24 * 60 * 60 * 1000);
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

export function parseDateRangeToDates(dateRange: string, fallbackYear: number): { start: Date; end: Date } | null {
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

export function formatPickerDateFromDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Valor do campo de data (AAAA-MM-DD) alinhado ao início da semana da parada salva — para import Last.fm na edição. */
export function lastfmWeekPickerValueFromChart(chart: { dateRange: string; weekLabel: string }): string | null {
  const weekLabel = normalizeWeekLabel(chart.weekLabel);
  const dateRange = normalizeDateRange(chart.dateRange);
  const year = parseWeekYear(weekLabel);
  const parsed = parseDateRangeToDates(dateRange, year);
  if (!parsed) return null;
  return formatPickerDateFromDate(parsed.start);
}

/** Mesmo parsing do campo `weekDate` em `POST /api/charts`. */
export function parseChartWeekPickerDate(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Intervalo Unix [from, to) para a semana da parada (meia-noite local na segunda
 * até meia-noite exclusiva na segunda após o domingo).
 */
export function chartWeekUnixRangeFromAnchor(weekAnchor: Date): { from: number; toExclusive: number } {
  const { start, end } = getChartWeekRange(weekAnchor);
  const fromMs = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime();
  const dayAfter = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return {
    from: Math.floor(fromMs / 1000),
    toExclusive: Math.floor(dayAfter.getTime() / 1000),
  };
}

/**
 * Prazo para paradas contarem no snapshot global de uma semana.
 * Retorna terça-feira 00:00 BRT (= 03:00 UTC) da semana seguinte ao weekIndex.
 * Charts com publishedAt >= este valor não entram no cálculo.
 */
export function getGlobalSnapshotDeadline(weekIndex: number): Date {
  const year = Math.floor(weekIndex / 100);
  const week = weekIndex % 100;
  // Jan 4 está sempre na semana ISO 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Segunda=1 … Domingo=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Dow + 1 + (week - 1) * 7);
  // Terça da semana seguinte = segunda + 8 dias, às 03:00 UTC (= 00:00 BRT)
  const deadline = new Date(monday);
  deadline.setUTCDate(monday.getUTCDate() + 8);
  deadline.setUTCHours(3, 0, 0, 0);
  return deadline;
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

