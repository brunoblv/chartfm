export const IG_RANGE_OPTIONS = [7, 14, 30, 90] as const;
export type IgRangeDays = (typeof IG_RANGE_OPTIONS)[number];

export function parseIgRange(raw: string | string[] | undefined): IgRangeDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (IG_RANGE_OPTIONS as readonly number[]).includes(n) ? (n as IgRangeDays) : 30;
}

/** "YYYY-MM-DD" (UTC). */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDay(d);
}

/** Dias corridos [from, to], inclusive. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * O insight vem com end_time no fim do dia (ex.: "2026-09-24T07:00:00+0000" fecha o dia 23).
 * Subtrair 1 dia do end_time dá o dia a que o valor se refere.
 */
export function insightEndTimeToDay(endTime: string): string {
  const t = new Date(endTime.replace(/\+0000$/, "Z")).getTime();
  return isoDay(new Date(t - 24 * 60 * 60 * 1000));
}

export type FollowerDayPoint = { day: string; net: number | null; total: number | null };

/**
 * Reconstrói o total de seguidores por dia a partir do total atual, andando para trás
 * com o saldo diário. Dias ainda não fechados pelo IG (net null) no fim da série são cortados —
 * o gráfico termina no último dia fechado. Snapshot de followers_count, quando existe, tem prioridade.
 */
export function buildFollowerSeries(
  days: string[],
  netByDay: Map<string, number>,
  currentTotal: number,
  snapshotByDay: Map<string, number> = new Map(),
): FollowerDayPoint[] {
  let lastSettled = -1;
  days.forEach((d, i) => {
    if (netByDay.has(d)) lastSettled = i;
  });
  if (lastSettled < 0) return [];

  const visible = days.slice(0, lastSettled + 1);
  const out: FollowerDayPoint[] = new Array(visible.length);
  // Seguidores ganhos depois do último dia visível que já conhecemos (dias posteriores fechados fora do range).
  let running = currentTotal;
  for (let i = visible.length - 1; i >= 0; i--) {
    const day = visible[i];
    const snap = snapshotByDay.get(day);
    if (snap != null) running = snap;
    const net = netByDay.get(day) ?? null;
    out[i] = { day, net, total: running };
    running -= net ?? 0;
  }
  return out;
}

export type VelocityTrend = "accelerating" | "decelerating" | "steady";
export type FollowerVelocity = {
  /** Saldo dos últimos 7 dias fechados ÷ total ao fim da semana, em %. */
  thisWeekPct: number;
  /** Média das semanas anteriores dentro da série, em %. null se não há semana anterior completa. */
  priorAvgPct: number | null;
  trend: VelocityTrend;
};

export function computeVelocity(series: FollowerDayPoint[]): FollowerVelocity | null {
  const weeks: number[] = [];
  for (let end = series.length; end - 7 >= 0; end -= 7) {
    const week = series.slice(end - 7, end);
    const net = week.reduce((s, p) => s + (p.net ?? 0), 0);
    const endTotal = week[6].total ?? 0;
    weeks.push(endTotal > 0 ? (net / endTotal) * 100 : 0);
  }
  if (weeks.length === 0) return null;
  const [thisWeekPct, ...prior] = weeks;
  const priorAvgPct = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : null;
  let trend: VelocityTrend = "steady";
  if (priorAvgPct != null) {
    // Margem de 10% para não oscilar entre estados com diferenças mínimas.
    const margin = Math.max(Math.abs(priorAvgPct) * 0.1, 0.05);
    if (thisWeekPct > priorAvgPct + margin) trend = "accelerating";
    else if (thisWeekPct < priorAvgPct - margin) trend = "decelerating";
  }
  return { thisWeekPct, priorAvgPct, trend };
}

export type IgMediaKind = "REEL" | "CAROUSEL" | "IMAGE" | "VIDEO";

export function mediaKind(mediaType: string | undefined, productType: string | undefined): IgMediaKind {
  if (productType === "REELS") return "REEL";
  if (mediaType === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (mediaType === "VIDEO") return "VIDEO";
  return "IMAGE";
}

/** Razão em % com proteção contra alcance zero/ausente. */
export function ratePct(numerator: number | null | undefined, reach: number | null | undefined): number | null {
  if (!reach || reach <= 0 || numerator == null) return null;
  return (numerator / reach) * 100;
}

/** Soma os resultados de um insight total_value com breakdown, por valor de dimensão. */
export function sumBreakdown(
  payloads: unknown[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const payload of payloads) {
    const data = (payload as any)?.data;
    if (!Array.isArray(data)) continue;
    for (const metric of data) {
      for (const breakdown of metric?.total_value?.breakdowns ?? []) {
        for (const r of breakdown?.results ?? []) {
          const key = String(r?.dimension_values?.[0] ?? "UNKNOWN");
          out.set(key, (out.get(key) ?? 0) + (Number(r?.value) || 0));
        }
      }
    }
  }
  return out;
}

/** Janelas de no máximo `maxDays` cobrindo [from, to] — a API recusa since/until maior que 30 dias. */
export function chunkRange(from: string, to: string, maxDays = 30): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = [];
  let start = from;
  while (start <= to) {
    const end = addDays(start, maxDays - 1) < to ? addDays(start, maxDays - 1) : to;
    out.push({ since: start, until: end });
    start = addDays(end, 1);
  }
  return out;
}
