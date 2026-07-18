/**
 * Hot 100 Retrospectivo — motor de cálculo determinístico (Fase 2).
 *
 * Puro e sem I/O: recebe o pool de músicas já hidratado (Last.fm + Song + histórico
 * de ChartEntry + overrides do usuário) e devolve o chart pontuado de um período.
 *
 * Fórmulas e pesos vêm de `public/planejamento/hot100retroativo(-plano).md`.
 * Todos os limiares ficam em `THRESHOLDS`/`WEIGHTS` para facilitar tuning.
 */

export type PeakPotential = "1" | "top3" | "top5" | "top10" | "top20" | "top40" | "top100" | "out";
export type HitLevel = "diamond" | "platinum" | "gold" | "silver" | "bronze" | "none";
export type Priority = "S" | "A" | "B" | "C" | "D";
export type Confidence = "alta" | "media" | "baixa";
export type RetroMode = "historico" | "retrospectivo";

/** Motivo pelo qual uma música não é elegível (ou o que a habilitou). */
export type EligibilityStatus =
  | "eligible"
  | "not_released" // lançamento posterior à data do chart
  | "no_release_date" // sem nenhuma data → precisa liberação manual
  | "no_scrobble_in_period"; // modo histórico: não foi ouvida no período

/** Origem da data de estreia usada como releaseRef. */
export type ReleaseRefSource = "single" | "album" | "clipe" | "top20";

/** Uma música do pool, já hidratada pelas fontes externas. */
export interface RetroSongInput {
  songId: string;
  /**
   * Data de estreia precomputada pelo build-pool (cadeia por parada-alvo:
   * single/clipe → álbum → clipe/single → 1ª entrada Top 20). Quando presente,
   * substitui a cadeia padrão de `releaseRefOf`.
   */
  releaseRef?: Date | null;
  /** Plays totais (all-time) do Last.fm — proxy de força no pré-2010. */
  overallPlaycount: number;
  /** Plays reais no mês do período (pós-Out/2010); null quando estimado. */
  periodPlaycount: number | null;
  /** Último scrobble do usuário — usado na recência da Importance. */
  lastScrobbleAt: Date | null;
  /** Houve scrobble real dentro do período? (gate do Modo Histórico). */
  hasScrobbleInPeriod: boolean;

  // Datas de referência (elegibilidade). Preferência: single > álbum > clipe.
  singleReleaseDate: Date | null;
  albumReleaseDate: Date | null;
  youtubeReleaseDate: Date | null;

  // Histórico Top20 do usuário (agregado dos ChartEntry publicados).
  top20Weeks: number;
  top20BestPeak: number | null; // 1 = melhor; null = nunca entrou
  numberOnes: number;

  // Overrides do RetroSongProfile / RetroEraOverride.
  manualImportance: number | null; // 0..100
  importanceLocked: boolean;
  manualPeakPotential: PeakPotential | null;
  manualAdjustment: number; // -50..+50
  eraOverrideWeight: number | null; // 0..100 para o ano do chart
}

export interface RetroContext {
  /** Último dia do mês selecionado (ex.: 2005-05-31). */
  chartDate: Date;
  mode: RetroMode;
  /** "Agora" — referência para recência dos plays. Injetável para testes. */
  now: Date;
  /** Tamanho do chart (ex.: 100). */
  chartSize: number;
}

/** Contribuição de cada componente para o Score Final, já em pontos (0..máximo). */
export interface ScoreBreakdown {
  period: number; // /30
  importance: number; // /30
  top20: number; // /15
  releaseRecency: number; // /10
  clip: number; // /10
  adjust: number; // /5
}

/** Máximo em pontos de cada componente do Score Final (para barras de UI). */
export const SCORE_COMPONENT_MAX: ScoreBreakdown = {
  period: 30,
  importance: 30,
  top20: 15,
  releaseRecency: 10,
  clip: 10,
  adjust: 5,
};

export interface RetroRow {
  songId: string;
  position: number | null; // null quando não elegível
  eligible: boolean;
  eligibilityStatus: EligibilityStatus;
  releaseRef: Date | null;
  eraWeight: number; // 0..1
  periodStrength: number; // 0..1 (real ou estimado)
  importance: number; // 0..100
  importanceIsManual: boolean;
  scoreFinal: number; // 0..100
  breakdown: ScoreBreakdown;
  peakPotential: PeakPotential;
  peakPotentialIsManual: boolean;
  hitLevel: HitLevel;
  priority: Priority;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Pesos e limiares (tunáveis)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  importance: { plays: 0.4, weeks: 0.25, ones: 0.15, peak: 0.1, recency: 0.1 },
  score: { period: 0.3, importance: 0.3, top20: 0.15, releaseRecency: 0.1, clip: 0.1, adjust: 0.05 },
} as const;

const THRESHOLDS = {
  /** Era Weight: meses de "auge" antes de começar a decair. */
  eraFullMonths: 12,
  /** Constante de decaimento (meses) do Era Weight após o auge. */
  eraDecayMonths: 36,
  /** Piso do Era Weight para músicas antigas ainda elegíveis. */
  eraFloor: 0.3,
  /** Janela (meses) da recência de lançamento no Score. */
  releaseRecencyMonths: 48,
  /** Anos até a recência de plays zerar na Importance. */
  playRecencyYears: 10,
} as const;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Meses (fracionários) de `from` até `to`. Negativo se `to` < `from`. */
export function monthsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.437);
}

/** Normalização logarítmica 0..1 contra o máximo do pool (playcounts são power-law). */
function normLog(value: number, poolMaxLog: number): number {
  if (poolMaxLog <= 0) return 0;
  return clamp01(Math.log1p(Math.max(0, value)) / poolMaxLog);
}

/** Data de referência para elegibilidade: precomputada > single > álbum > clipe. */
export function releaseRefOf(s: RetroSongInput): Date | null {
  if (s.releaseRef !== undefined) return s.releaseRef;
  return s.singleReleaseDate ?? s.albumReleaseDate ?? s.youtubeReleaseDate ?? null;
}

// ---------------------------------------------------------------------------
// Elegibilidade
// ---------------------------------------------------------------------------

export function evaluateEligibility(s: RetroSongInput, ctx: RetroContext): EligibilityStatus {
  const ref = releaseRefOf(s);
  if (!ref) return "no_release_date";
  if (ref.getTime() > ctx.chartDate.getTime()) return "not_released";
  if (ctx.mode === "historico" && !s.hasScrobbleInPeriod) return "no_scrobble_in_period";
  return "eligible";
}

// ---------------------------------------------------------------------------
// Era Weight — quão "na época" a música está na data do chart (0..1)
// ---------------------------------------------------------------------------

export function computeEraWeight(s: RetroSongInput, ctx: RetroContext): number {
  if (s.eraOverrideWeight != null) return clamp01(s.eraOverrideWeight / 100);
  const ref = releaseRefOf(s);
  if (!ref) return 0;
  const months = monthsBetween(ref, ctx.chartDate);
  if (months < 0) return 0; // ainda não lançada
  if (months <= THRESHOLDS.eraFullMonths) return 1;
  const decayed = Math.exp(-(months - THRESHOLDS.eraFullMonths) / THRESHOLDS.eraDecayMonths);
  return clamp01(THRESHOLDS.eraFloor + (1 - THRESHOLDS.eraFloor) * decayed);
}

// ---------------------------------------------------------------------------
// Componentes normalizados
// ---------------------------------------------------------------------------

/** Pico Top20 → 0..1 (1 = melhor). null (nunca entrou) = 0. */
function peakScore(bestPeak: number | null): number {
  if (bestPeak == null) return 0;
  return clamp01((21 - bestPeak) / 20);
}

/** Recência do último scrobble → 0..1 (mais recente = maior). */
function playRecencyScore(lastScrobbleAt: Date | null, now: Date): number {
  if (!lastScrobbleAt) return 0;
  const years = monthsBetween(lastScrobbleAt, now) / 12;
  return clamp01(1 - years / THRESHOLDS.playRecencyYears);
}

/** Recência do lançamento vs data do chart → 0..1 (mais próximo = "música do momento"). */
function releaseRecencyScore(ref: Date | null, chartDate: Date): number {
  if (!ref) return 0;
  const months = monthsBetween(ref, chartDate);
  if (months < 0) return 0;
  return clamp01(1 - months / THRESHOLDS.releaseRecencyMonths);
}

/** Bônus de clipe: lançado até a data do chart. */
function clipScore(youtubeReleaseDate: Date | null, chartDate: Date): number {
  if (!youtubeReleaseDate) return 0;
  return youtubeReleaseDate.getTime() <= chartDate.getTime() ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Importance (0..100) — global; usa override quando travada/definida
// ---------------------------------------------------------------------------

interface PoolMax {
  overallLog: number;
  periodLog: number;
  weeks: number;
  ones: number;
}

function computeImportance(s: RetroSongInput, ctx: RetroContext, pool: PoolMax): { value: number; manual: boolean } {
  if (s.manualImportance != null) {
    return { value: clamp01(s.manualImportance / 100) * 100, manual: true };
  }
  const w = WEIGHTS.importance;
  const raw =
    w.plays * normLog(s.overallPlaycount, pool.overallLog) +
    w.weeks * clamp01(pool.weeks > 0 ? s.top20Weeks / pool.weeks : 0) +
    w.ones * clamp01(pool.ones > 0 ? s.numberOnes / pool.ones : 0) +
    w.peak * peakScore(s.top20BestPeak) +
    w.recency * playRecencyScore(s.lastScrobbleAt, ctx.now);
  return { value: clamp01(raw) * 100, manual: false };
}

// ---------------------------------------------------------------------------
// Derivados: Peak Potential, Hit Level, Prioridade, Confiança
// ---------------------------------------------------------------------------

export function derivePeakPotential(scoreFinal: number): PeakPotential {
  if (scoreFinal >= 90) return "1";
  if (scoreFinal >= 85) return "top3";
  if (scoreFinal >= 78) return "top5";
  if (scoreFinal >= 62) return "top10";
  if (scoreFinal >= 45) return "top20";
  if (scoreFinal >= 30) return "top40";
  if (scoreFinal >= 15) return "top100";
  return "out";
}

export function deriveHitLevel(importance: number, numberOnes: number, top20Weeks: number): HitLevel {
  if (importance >= 90 && numberOnes >= 1) return "diamond";
  if (importance >= 80 && (numberOnes >= 1 || top20Weeks >= 10)) return "platinum";
  if (importance >= 65) return "gold";
  if (importance >= 45) return "silver";
  if (importance >= 25) return "bronze";
  return "none";
}

export function derivePriority(scoreFinal: number, hitLevel: HitLevel): Priority {
  if (hitLevel === "diamond" || scoreFinal >= 88) return "S";
  if (hitLevel === "platinum" || scoreFinal >= 78) return "A";
  if (scoreFinal >= 62) return "B";
  if (scoreFinal >= 45) return "C";
  return "D";
}

export function deriveConfidence(s: RetroSongInput): Confidence {
  const signals = [
    releaseRefOf(s) != null, // sabemos quando lançou
    s.periodPlaycount != null, // temos plays reais do período
    s.top20Weeks > 0, // temos histórico Top20
    s.youtubeReleaseDate != null, // sabemos do clipe
  ].filter(Boolean).length;
  if (signals >= 3) return "alta";
  if (signals === 2) return "media";
  return "baixa";
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

/**
 * Pontua e ordena o pool para um período. Elegíveis recebem posição; não
 * elegíveis vêm com `position = null` e o motivo em `eligibilityStatus`.
 *
 * A normalização (importance/score) usa apenas o pool ELEGÍVEL como referência.
 */
export function buildRetroChart(songs: RetroSongInput[], ctx: RetroContext): RetroRow[] {
  // 1) Elegibilidade
  const evaluated = songs.map((s) => ({ s, status: evaluateEligibility(s, ctx) }));
  const eligible = evaluated.filter((e) => e.status === "eligible");

  // 2) Máximos do pool para normalização (só elegíveis)
  const pool: PoolMax = {
    overallLog: Math.max(0, ...eligible.map((e) => Math.log1p(Math.max(0, e.s.overallPlaycount)))),
    periodLog: Math.max(0, ...eligible.map((e) => Math.log1p(Math.max(0, e.s.periodPlaycount ?? 0)))),
    weeks: Math.max(0, ...eligible.map((e) => e.s.top20Weeks)),
    ones: Math.max(0, ...eligible.map((e) => e.s.numberOnes)),
  };

  // 3) Pontuação
  const rows: RetroRow[] = evaluated.map(({ s, status }) => {
    const eligible = status === "eligible";
    const ref = releaseRefOf(s);
    const eraWeight = computeEraWeight(s, ctx);

    // Força do período: plays reais (pós-2010) OU overall×eraWeight (pré-2010 estimado)
    const periodStrength =
      s.periodPlaycount != null
        ? normLog(s.periodPlaycount, pool.periodLog)
        : normLog(s.overallPlaycount, pool.overallLog) * eraWeight;

    const { value: importance, manual: importanceIsManual } = computeImportance(s, ctx, pool);

    const w = WEIGHTS.score;
    const top20Composite = 0.6 * peakScore(s.top20BestPeak) + 0.4 * clamp01(pool.weeks > 0 ? s.top20Weeks / pool.weeks : 0);
    const adjustScore = clamp01((s.manualAdjustment + 50) / 100);

    const c = {
      period: w.period * periodStrength,
      importance: w.importance * (importance / 100),
      top20: w.top20 * top20Composite,
      releaseRecency: w.releaseRecency * releaseRecencyScore(ref, ctx.chartDate),
      clip: w.clip * clipScore(s.youtubeReleaseDate, ctx.chartDate),
      adjust: w.adjust * adjustScore,
    };
    const score01 = c.period + c.importance + c.top20 + c.releaseRecency + c.clip + c.adjust;
    const scoreFinal = eligible ? clamp01(score01) * 100 : 0;
    const scale = eligible ? 100 : 0;
    const breakdown: ScoreBreakdown = {
      period: c.period * scale,
      importance: c.importance * scale,
      top20: c.top20 * scale,
      releaseRecency: c.releaseRecency * scale,
      clip: c.clip * scale,
      adjust: c.adjust * scale,
    };

    const derivedPeak = derivePeakPotential(scoreFinal);
    const peakPotential = s.manualPeakPotential ?? derivedPeak;
    const hitLevel = deriveHitLevel(importance, s.numberOnes, s.top20Weeks);

    return {
      songId: s.songId,
      position: null, // preenchido depois
      eligible,
      eligibilityStatus: status,
      releaseRef: ref,
      eraWeight,
      periodStrength,
      importance,
      importanceIsManual,
      scoreFinal,
      breakdown,
      peakPotential,
      peakPotentialIsManual: s.manualPeakPotential != null,
      hitLevel,
      priority: derivePriority(scoreFinal, hitLevel),
      confidence: deriveConfidence(s),
    };
  });

  // 4) Ordena elegíveis por score e atribui posição (respeitando chartSize)
  const ordered = rows
    .filter((r) => r.eligible)
    .sort((a, b) => b.scoreFinal - a.scoreFinal || b.importance - a.importance);
  ordered.forEach((r, i) => {
    r.position = i < ctx.chartSize ? i + 1 : null;
  });

  return rows;
}
