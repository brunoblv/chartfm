/** Cálculos puros do dashboard de Instagram (sem I/O) — testados em instagram-analytics.test.ts. */

export type IgMediaKind = "REEL" | "IMAGE" | "CAROUSEL" | "VIDEO";

export type IgMediaRow = {
  id: string;
  kind: IgMediaKind;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  interactions: number;
  follows: number | null;
  profileVisits: number | null;
  /** ms */
  avgWatchTimeMs: number | null;
  /** ms */
  totalWatchTimeMs: number | null;
  /** 0–100 */
  skipRate: number | null;
};

export type DailyValue = { date: string; value: number };

export function safeRatio(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null || den <= 0) return null;
  return num / den;
}

export function engagementRate(row: Pick<IgMediaRow, "interactions" | "reach">): number | null {
  return safeRatio(row.interactions, row.reach);
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function average(values: (number | null | undefined)[]): number | null {
  const clean = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return clean.length ? sum(clean) / clean.length : null;
}

/** Soma os ganhos líquidos diários a partir do total atual (o Instagram só expõe o saldo por dia, não o histórico do total). */
export function reconstructFollowerTotals(currentTotal: number, dailyNet: DailyValue[]): DailyValue[] {
  const sorted = [...dailyNet].sort((a, b) => a.date.localeCompare(b.date));
  const totals: DailyValue[] = new Array(sorted.length);
  let running = currentTotal;
  for (let i = sorted.length - 1; i >= 0; i--) {
    totals[i] = { date: sorted[i].date, value: running };
    running -= sorted[i].value;
  }
  return totals;
}

export type Velocity = {
  thisWeekNet: number;
  thisWeekPct: number | null;
  priorWeeksAvgPct: number | null;
  trend: "accelerating" | "decelerating" | "steady" | "unknown";
};

/** Últimos 7 dias assentados vs média das semanas anteriores, como % do total de seguidores. */
export function followerVelocity(currentTotal: number, dailyNet: DailyValue[]): Velocity {
  const sorted = [...dailyNet].sort((a, b) => a.date.localeCompare(b.date));
  const lastWeek = sorted.slice(-7);
  const prior = sorted.slice(0, Math.max(0, sorted.length - 7));
  const thisWeekNet = sum(lastWeek.map((d) => d.value));
  const thisWeekPct = currentTotal > 0 && lastWeek.length > 0 ? (thisWeekNet / currentTotal) * 100 : null;

  let priorWeeksAvgPct: number | null = null;
  if (prior.length >= 7 && currentTotal > 0) {
    const weeks = prior.length / 7;
    priorWeeksAvgPct = (sum(prior.map((d) => d.value)) / weeks / currentTotal) * 100;
  }

  let trend: Velocity["trend"] = "unknown";
  if (thisWeekPct != null && priorWeeksAvgPct != null) {
    const diff = thisWeekPct - priorWeeksAvgPct;
    if (Math.abs(diff) < 0.1) trend = "steady";
    else trend = diff > 0 ? "accelerating" : "decelerating";
  }
  return { thisWeekNet, thisWeekPct, priorWeeksAvgPct, trend };
}

export type PostTotals = {
  count: number;
  avgEngagementRate: number | null;
  followerConversion: number | null;
  totalFollows: number;
  profileVisitRate: number | null;
};

export function postTotals(rows: IgMediaRow[]): PostTotals {
  const withFollows = rows.filter((r) => r.follows != null);
  const withVisits = rows.filter((r) => r.profileVisits != null);
  const totalFollows = sum(withFollows.map((r) => r.follows ?? 0));
  return {
    count: rows.length,
    avgEngagementRate: average(rows.map(engagementRate)),
    totalFollows,
    followerConversion: withFollows.length ? safeRatio(totalFollows, sum(withFollows.map((r) => r.reach))) : null,
    profileVisitRate: withVisits.length ? safeRatio(sum(withVisits.map((r) => r.profileVisits ?? 0)), sum(withVisits.map((r) => r.reach))) : null,
  };
}

export type ReelTotals = {
  count: number;
  avgWatchTimeMs: number | null;
  bestAvgWatchTimeMs: number | null;
  rewatchRatio: number | null;
  totalWatchHours: number | null;
  topReelWatchHours: number | null;
  avgSkipRate: number | null;
};

export function reelTotals(rows: IgMediaRow[]): ReelTotals {
  const watch = rows.map((r) => r.avgWatchTimeMs).filter((v): v is number => v != null);
  const total = rows.map((r) => r.totalWatchTimeMs).filter((v): v is number => v != null);
  const views = sum(rows.map((r) => r.views));
  const reach = sum(rows.map((r) => r.reach));
  const toHours = (ms: number) => ms / 3_600_000;
  return {
    count: rows.length,
    avgWatchTimeMs: average(watch),
    bestAvgWatchTimeMs: watch.length ? Math.max(...watch) : null,
    rewatchRatio: safeRatio(views, reach),
    totalWatchHours: total.length ? toHours(sum(total)) : null,
    topReelWatchHours: total.length ? toHours(Math.max(...total)) : null,
    avgSkipRate: average(rows.map((r) => r.skipRate)),
  };
}

/** Top-N por uma métrica derivada, ignorando linhas onde a métrica não existe. */
export function rankBy(rows: IgMediaRow[], metric: (r: IgMediaRow) => number | null, n: number, direction: "desc" | "asc" = "desc") {
  return rows
    .map((row) => ({ row, value: metric(row) }))
    .filter((x): x is { row: IgMediaRow; value: number } => x.value != null && Number.isFinite(x.value))
    .sort((a, b) => (direction === "desc" ? b.value - a.value : a.value - b.value))
    .slice(0, n);
}

// ── Insights heurísticos dos reels ───────────────────────────────────────────

export type CaptionFormat = "list" | "question" | "tutorial" | "other";

/** Classificação por regex da legenda — heurística barata, não é IA. */
export function captionFormat(caption: string): CaptionFormat {
  const firstLine = caption.split("\n")[0]?.trim().toLowerCase() ?? "";
  if (/^(top\s*)?\d{1,2}\b|\btop\s*\d{1,2}\b|\b\d{1,2}\s+(músicas|musicas|songs|artistas|artists|álbuns|albuns|albums|motivos|reasons|coisas|things|dicas|tips)\b/.test(firstLine)) {
    return "list";
  }
  if (firstLine.includes("?")) return "question";
  if (/\b(como|how to|passo a passo|tutorial|guia|guide)\b/.test(firstLine)) return "tutorial";
  return "other";
}

export type HookStrength = "strong" | "moderate" | "weak";

export function hookStrength(skipRate: number | null): HookStrength | null {
  if (skipRate == null) return null;
  if (skipRate < 30) return "strong";
  if (skipRate <= 45) return "moderate";
  return "weak";
}

export type Daypart = "morning" | "afternoon" | "evening" | "night";

export function daypart(iso: string, timeZone = "America/Sao_Paulo"): Daypart {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date(iso)));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

export type TraitBucket = { key: string; count: number; avgViews: number; multiplier: number };

export function bucketByTrait(rows: IgMediaRow[], trait: (r: IgMediaRow) => string | null): TraitBucket[] {
  const overall = average(rows.map((r) => r.views)) ?? 0;
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = trait(row);
    if (key == null) continue;
    const list = groups.get(key) ?? [];
    list.push(row.views);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, views]) => {
      const avgViews = sum(views) / views.length;
      return { key, count: views.length, avgViews, multiplier: overall > 0 ? avgViews / overall : 0 };
    })
    .sort((a, b) => b.avgViews - a.avgViews);
}

export type ReelInsight = {
  kind: "win" | "gap";
  dimension: "format" | "hook" | "daypart";
  key: string;
  avgViews: number;
  comparisonViews: number;
  multiplier: number;
  count: number;
};

/**
 * Compara cada grupo com a média dos demais. Só vira insight quando o grupo tem
 * ≥2 reels e a diferença é ≥25% — amostras pequenas geram falsos padrões.
 */
export function reelInsights(rows: IgMediaRow[], timeZone?: string): ReelInsight[] {
  const dims: { dimension: ReelInsight["dimension"]; trait: (r: IgMediaRow) => string | null }[] = [
    { dimension: "format", trait: (r) => captionFormat(r.caption) },
    { dimension: "hook", trait: (r) => hookStrength(r.skipRate) },
    { dimension: "daypart", trait: (r) => daypart(r.timestamp, timeZone) },
  ];
  const out: ReelInsight[] = [];
  for (const { dimension, trait } of dims) {
    for (const bucket of bucketByTrait(rows, trait)) {
      // "other" é o resto não classificado — não é um padrão acionável.
      if (bucket.count < 2 || bucket.key === "other") continue;
      const others = rows.filter((r) => trait(r) != null && trait(r) !== bucket.key);
      if (others.length < 2) continue;
      const comparisonViews = sum(others.map((r) => r.views)) / others.length;
      if (comparisonViews <= 0) continue;
      const multiplier = bucket.avgViews / comparisonViews;
      if (multiplier >= 1.25) out.push({ kind: "win", dimension, key: bucket.key, avgViews: bucket.avgViews, comparisonViews, multiplier, count: bucket.count });
      else if (multiplier <= 0.8) out.push({ kind: "gap", dimension, key: bucket.key, avgViews: bucket.avgViews, comparisonViews, multiplier, count: bucket.count });
    }
  }
  return out.sort((a, b) => Math.abs(Math.log(b.multiplier)) - Math.abs(Math.log(a.multiplier)));
}

// ── Timing ───────────────────────────────────────────────────────────────────

export type SlotPerformance = { key: number; count: number; avgReach: number; avgEngagementRate: number | null };

/** Desempenho médio dos posts agrupado por dia da semana (0=dom) ou hora de publicação. */
export function performanceBySlot(rows: IgMediaRow[], slot: "weekday" | "hour", timeZone = "America/Sao_Paulo"): SlotPerformance[] {
  const fmt =
    slot === "weekday"
      ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone })
      : new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const groups = new Map<number, IgMediaRow[]>();
  for (const row of rows) {
    const raw = fmt.format(new Date(row.timestamp));
    const key = slot === "weekday" ? weekdays.indexOf(raw) : Number(raw);
    if (key < 0 || !Number.isFinite(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      count: list.length,
      avgReach: sum(list.map((r) => r.reach)) / list.length,
      avgEngagementRate: average(list.map(engagementRate)),
    }))
    .sort((a, b) => a.key - b.key);
}

/** online_followers vem como um mapa hora→contagem por dia; tira a média por hora. */
export function averageOnlineByHour(days: Record<string, number>[]): number[] {
  const totals = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const day of days) {
    for (const [hour, value] of Object.entries(day)) {
      const h = Number(hour);
      if (h >= 0 && h < 24 && Number.isFinite(value)) {
        totals[h] += value;
        counts[h] += 1;
      }
    }
  }
  return totals.map((t, i) => (counts[i] ? t / counts[i] : 0));
}
