/**
 * Log de uso da API do Deezer — enxuto, sem apps/pools (Deezer é público, sem
 * client credentials): só total de chamadas, 429s e os últimos erros, para
 * parar de ser invisível no /admin/logs (antes só existia log do Spotify em
 * lib/spotify-usage-log.ts).
 *
 * Em memória (zera no restart do pm2), mesmo espírito do log do Spotify: o
 * objetivo é diagnóstico das últimas horas, não auditoria.
 */

export type DeezerCallRecord = {
  ts: number;
  endpoint: string; // normalizado: /track, /album/{id}, /search/track, ...
  status: number | null; // null = falha de rede/timeout
  ok: boolean;
  retries: number;
  durationMs: number | null;
  error: string | null;
};

const MAX_RECORDS = 500;
const records: DeezerCallRecord[] = [];

function normalizeEndpoint(path: string): string {
  return path
    .split("?")[0]!
    .replace(/\/\d+(?=\/|$)/g, "/{id}")
    .replace(/^\/track\/isrc:[^/]+$/, "/track/isrc:{isrc}");
}

export function recordDeezerCall(opts: {
  path: string;
  status: number | null;
  ok: boolean;
  retries?: number;
  durationMs?: number | null;
  error?: string | null;
}): void {
  try {
    const rec: DeezerCallRecord = {
      ts: Date.now(),
      endpoint: normalizeEndpoint(opts.path),
      status: opts.status,
      ok: opts.ok,
      retries: opts.retries ?? 0,
      durationMs: opts.durationMs ?? null,
      error: opts.error ?? null,
    };
    records.push(rec);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
  } catch {
    // log nunca pode quebrar o fluxo principal
  }
}

export type DeezerUsageSummary = {
  since: number;
  totalCalls: number;
  totalErrors: number;
  total429: number;
  avgDurationMs: number | null;
  byEndpoint: { endpoint: string; total: number; errors: number }[];
  recentErrors: DeezerCallRecord[];
};

export function getDeezerUsageSummary(hours = 24): DeezerUsageSummary {
  const since = Date.now() - hours * 3_600_000;
  const inWindow = records.filter((r) => r.ts >= since);

  const endpointAgg = new Map<string, { total: number; errors: number }>();
  for (const r of inWindow) {
    const agg = endpointAgg.get(r.endpoint) ?? { total: 0, errors: 0 };
    agg.total += 1;
    if (!r.ok) agg.errors += 1;
    endpointAgg.set(r.endpoint, agg);
  }

  const withDuration = inWindow.filter((r) => r.durationMs != null && r.durationMs >= 0);
  const avgDurationMs =
    withDuration.length > 0
      ? Math.round(withDuration.reduce((s, r) => s + (r.durationMs ?? 0), 0) / withDuration.length)
      : null;

  return {
    since,
    totalCalls: inWindow.length,
    totalErrors: inWindow.filter((r) => !r.ok).length,
    total429: inWindow.filter((r) => r.status === 429).length,
    avgDurationMs,
    byEndpoint: [...endpointAgg.entries()]
      .map(([endpoint, agg]) => ({ endpoint, total: agg.total, errors: agg.errors }))
      .sort((a, b) => b.total - a.total),
    recentErrors: inWindow.filter((r) => !r.ok).slice(-30).reverse(),
  };
}
