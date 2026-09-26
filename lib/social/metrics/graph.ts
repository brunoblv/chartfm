import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import { timedFetch } from "@/lib/social/publish/shared";

export type InsightValues = Record<string, number>;

export type InsightsResult = {
  values: InsightValues;
  /** Métricas que a API recusou (descontinuadas/sem suporte para o tipo de mídia). */
  unavailable: string[];
  /** Erro fatal (token/permissão/rede) — nenhuma métrica veio. */
  error: string | null;
};

type FetchResult = Awaited<ReturnType<typeof timedFetch>>;

export function graphErrorMessage(res: FetchResult): string {
  const message = res.json?.error?.message ?? ("error" in res ? res.error : null) ?? `HTTP ${res.status}`;
  return sanitizeErrorMessage(message);
}

/** Erros que não melhoram tentando métrica por métrica: token inválido, permissão, rate limit, rede. */
export function isFatalGraphError(res: FetchResult): boolean {
  if (res.status === 0 || res.status >= 500) return true;
  const code = res.json?.error?.code;
  return code === 190 || code === 10 || code === 200 || code === 4 || code === 17 || code === 32 || code === 613;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Métricas com breakdown (ex.: post_reactions_by_type_total) chegam como {like: 3, love: 1}.
  if (value && typeof value === "object") {
    let sum = 0;
    let found = false;
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        found = true;
      }
    }
    return found ? sum : null;
  }
  return null;
}

/** Normaliza a resposta de /insights (Instagram e Facebook usam o mesmo formato). */
export function parseInsightsResponse(json: unknown): InsightValues {
  const out: InsightValues = {};
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    const name = item?.name;
    if (typeof name !== "string") continue;
    const values = Array.isArray(item.values) ? item.values : [];
    const raw = item.total_value?.value ?? values[values.length - 1]?.value;
    const n = toNumber(raw);
    if (n !== null) out[name] = n;
  }
  return out;
}

/**
 * Busca várias métricas de /insights. Uma única métrica descontinuada ou não suportada
 * para aquele tipo de mídia derruba a chamada inteira (erro #100), então no erro
 * refaz uma a uma e guarda só as que vieram.
 */
export async function fetchInsightsResilient(buildUrl: (metrics: string[]) => string, metrics: string[]): Promise<InsightsResult> {
  const all = await timedFetch(buildUrl(metrics));
  if (all.ok) {
    const values = parseInsightsResponse(all.json);
    return { values, unavailable: metrics.filter((m) => !(m in values)), error: null };
  }
  if (isFatalGraphError(all)) return { values: {}, unavailable: [], error: graphErrorMessage(all) };

  const values: InsightValues = {};
  const unavailable: string[] = [];
  let lastError: string | null = null;
  for (const metric of metrics) {
    const res = await timedFetch(buildUrl([metric]));
    if (res.ok) {
      Object.assign(values, parseInsightsResponse(res.json));
      if (!(metric in values)) unavailable.push(metric);
      continue;
    }
    if (isFatalGraphError(res)) return { values, unavailable, error: graphErrorMessage(res) };
    unavailable.push(metric);
    lastError = graphErrorMessage(res);
  }
  const error = Object.keys(values).length === 0 ? lastError ?? graphErrorMessage(all) : null;
  return { values, unavailable, error };
}

export function buildUrl(base: string, path: string, params: Record<string, string>): string {
  return `${base}/${path}?${new URLSearchParams(params).toString()}`;
}
