/**
 * Hot 100 Retrospectivo — simulação semanal (Fase 7 do plano, agora o núcleo).
 *
 * Modelo "estreia + carry-over": cada música estreia na semana exata do seu
 * lançamento com um Score Final (0-100) já calculado pelo motor mensal de
 * curadoria (`scoring.ts` via `buildRetroChart`, com todos os ajustes manuais
 * do usuário aplicados). A partir daí, ninguém mais recalcula nada por Last.fm —
 * o poder da música evolui sozinho: sobe até um pico (momentum) e depois decai
 * até sair da parada. Isso reproduz a curva entrada→pico→saída do spec
 * (`hot100retroativo.md` §"Pico") sem precisar de dado semanal real, que não
 * existe para a maior parte da história do usuário.
 *
 * Puro e sem I/O — datas assumidas em UTC (meia-noite). `generate-history.ts`
 * fornece as estreias (uma por música) e persiste o resultado.
 */

export interface WeeklyDebut {
  songId: string;
  /** Data de estreia (UTC) — define em qual semana ISO a música entra. */
  debutDate: Date;
  /** Score Final (0-100) calculado no mês de estreia pelo motor de curadoria. */
  scoreFinal: number;
}

export type WeeklyStatus = "new" | "up" | "down" | "same";

export interface WeeklyChartRow {
  songId: string;
  position: number;
  power: number;
  status: WeeklyStatus;
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
}

export interface WeeklySnapshot {
  weekIndex: number;
  weekStartDate: Date; // segunda-feira, UTC
  weekLabel: string;
  dateRange: string;
  entries: WeeklyChartRow[];
}

export interface SimulateWeeklyChartArgs {
  /** Uma estreia por música (a mesma lista serve para todo o intervalo). */
  debuts: WeeklyDebut[];
  /** Ano de início da simulação (semana ISO 1). */
  startYear: number;
  /** Simula até (exclusive) este weekIndex — nunca gera aqui ou depois. */
  endWeekIndexExclusive: number;
  chartSize: number;
}

// ---------------------------------------------------------------------------
// Curva de poder: entra fraca, sobe até um pico (momentum), depois decai.
// Tunável e deliberadamente simples (v1, não calibrado com dado real) — ver
// `hot100retroativo-plano.md` §2.7.
// ---------------------------------------------------------------------------

const CURVE = {
  /** Poder relativo à estreia, como fração do Score Final (a música entra "fraca"). */
  entryFactor: 0.35,
  /** Semanas até o pico: de 1 (score baixo) a 6 (hit forte, sobe mais devagar). */
  minPeakWeek: 1,
  maxPeakWeek: 6,
  /** Decaimento semanal pós-pico: de 0.80 (fraca, sai rápido) a 0.97 (hit, dura meses). */
  minDecay: 0.8,
  maxDecay: 0.97,
  /** Poder mínimo para continuar na parada, mesmo com vaga livre. */
  floorPower: 4,
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function peakWeekFor(scoreFinal: number): number {
  const t = clamp01(scoreFinal / 100);
  return Math.round(CURVE.minPeakWeek + t * (CURVE.maxPeakWeek - CURVE.minPeakWeek));
}

function decayFactorFor(scoreFinal: number): number {
  const t = clamp01(scoreFinal / 100);
  return CURVE.minDecay + t * (CURVE.maxDecay - CURVE.minDecay);
}

/** Poder da música na semana `weeksOnChart` (0 = semana de estreia). */
export function powerAt(scoreFinal: number, weeksOnChart: number): number {
  if (weeksOnChart <= 0) return scoreFinal * CURVE.entryFactor;
  const peakWeek = peakWeekFor(scoreFinal);
  if (weeksOnChart < peakWeek) {
    const t = weeksOnChart / peakWeek;
    return scoreFinal * (CURVE.entryFactor + t * (1 - CURVE.entryFactor));
  }
  const decay = decayFactorFor(scoreFinal);
  return scoreFinal * Math.pow(decay, weeksOnChart - peakWeek);
}

// ---------------------------------------------------------------------------
// Datas: semana ISO em UTC puro (nunca depende do fuso do servidor — datas
// históricas de décadas atrás não podem escorregar de dia por TZ local).
// ---------------------------------------------------------------------------

function isoWeekInfoUTC(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** `weekIndex` no mesmo formato do banco: `anoISO*100 + semanaISO`. */
export function weekIndexUTC(date: Date): number {
  const { year, week } = isoWeekInfoUTC(date);
  return year * 100 + week;
}

/** Segunda a domingo (UTC) da semana ISO que contém `date`. */
export function weekRangeUTC(date: Date): { start: Date; end: Date } {
  const day = date.getUTCDay(); // 0=dom..6=sáb
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + (day === 0 ? 0 : 7 - day));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return { start, end };
}

/** Segunda-feira da semana ISO 1 de `year`, em UTC (4 de janeiro está sempre na semana 1). */
export function mondayOfIsoWeek1UTC(year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7; // Segunda=1..Domingo=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1);
  return monday;
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDDMMYYYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

interface TrackedSong {
  songId: string;
  scoreFinal: number;
  weeksOnChart: number; // 0 na semana de estreia
  peak: number;
  prevPos: number | null;
}

/**
 * Simula semana a semana, de `startYear` (semana ISO 1) até `endWeekIndexExclusive`.
 * Carry-over puro: uma música só sai da parada quando o poder cai (nunca reentra).
 */
export function simulateWeeklyChart(args: SimulateWeeklyChartArgs): WeeklySnapshot[] {
  const { debuts, startYear, endWeekIndexExclusive, chartSize } = args;

  const debutsByWeek = new Map<number, WeeklyDebut[]>();
  for (const d of debuts) {
    const wi = weekIndexUTC(d.debutDate);
    const list = debutsByWeek.get(wi) ?? [];
    list.push(d);
    debutsByWeek.set(wi, list);
  }

  const tracked = new Map<string, TrackedSong>();
  const snapshots: WeeklySnapshot[] = [];

  let anchor = mondayOfIsoWeek1UTC(startYear);
  let wi = weekIndexUTC(anchor);

  while (wi < endWeekIndexExclusive) {
    // 1) Quem já estava na parada envelhece uma semana (poder decai/sobe pela curva).
    for (const t of tracked.values()) t.weeksOnChart += 1;

    // 2) Estreias desta semana entram com weeksOnChart = 0 (podem começar "de baixo").
    for (const d of debutsByWeek.get(wi) ?? []) {
      if (tracked.has(d.songId)) continue; // defensivo: nunca deveria duplicar
      tracked.set(d.songId, { songId: d.songId, scoreFinal: d.scoreFinal, weeksOnChart: 0, peak: Infinity, prevPos: null });
    }

    // 3) Poder de todo mundo ainda "vivo" (acima do piso) — inclui quem está
    //    "borbulhando" fora do chart visível (ex.: subindo, ainda não entrou no
    //    top N). Só sai de vez quando o poder cai abaixo do piso (sem reentrada).
    const alive = Array.from(tracked.values())
      .map((t) => ({ t, power: powerAt(t.scoreFinal, t.weeksOnChart) }))
      .filter((r) => r.power >= CURVE.floorPower)
      .sort((a, b) => b.power - a.power || b.t.scoreFinal - a.t.scoreFinal || a.t.songId.localeCompare(b.t.songId));

    const aliveIds = new Set(alive.map((r) => r.t.songId));
    for (const id of Array.from(tracked.keys())) {
      if (!aliveIds.has(id)) tracked.delete(id); // decaiu de vez
    }

    const visible = alive.slice(0, chartSize);
    const visibleIds = new Set(visible.map((r) => r.t.songId));
    // Quem está viva mas fora do top N esta semana "não estava no chart" —
    // se subir depois, entra como novidade, não como "up" a partir do limbo.
    for (const r of alive) {
      if (!visibleIds.has(r.t.songId)) r.t.prevPos = null;
    }

    const entries: WeeklyChartRow[] = visible.map((r, i) => {
      const position = i + 1;
      const t = r.t;
      const prevPos = t.prevPos;
      const peak = Math.min(t.peak === Infinity ? position : t.peak, position);
      const weeks = t.weeksOnChart + 1; // 1-indexado: semana de estreia = 1

      let status: WeeklyStatus;
      let delta: number | null;
      if (prevPos == null) {
        status = "new";
        delta = null;
      } else {
        delta = prevPos - position;
        status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
      }

      t.peak = peak;
      t.prevPos = position;

      return { songId: t.songId, position, power: r.power, status, delta, prevPos, peak, weeks };
    });

    if (entries.length > 0) {
      const { start, end } = weekRangeUTC(anchor);
      snapshots.push({
        weekIndex: wi,
        weekStartDate: start,
        weekLabel: `Semana ${wi % 100} - ${Math.floor(wi / 100)}`,
        dateRange: `${fmtDDMMYYYY(start)} a ${fmtDDMMYYYY(end)}`,
        entries,
      });
    }

    anchor = addDaysUTC(anchor, 7);
    wi = weekIndexUTC(anchor);
  }

  return snapshots;
}
