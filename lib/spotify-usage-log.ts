/**
 * Log de uso da API do Spotify — registra toda chamada feita via spotifyFetch
 * (e a entrega de tokens ao browser) para diagnosticar de onde vem o consumo.
 *
 * Em memória (ring buffer + agregados por hora); zera no restart do pm2, o que
 * é aceitável: o objetivo é diagnóstico das últimas horas, não auditoria.
 */

export type SpotifyCallRecord = {
  ts: number;
  endpoint: string; // normalizado: /search, /tracks/{id}, token, browser-token, ...
  app: "primary" | "backup" | "token" | "browser";
  status: number | null; // null = falha de rede/timeout
  retryAfterS: number | null;
  caller: string; // função/arquivo de origem (melhor esforço via stack)
};

const MAX_RECORDS = 2000;
const records: SpotifyCallRecord[] = [];

// Agregado por hora (chave = epoch-hora) → por endpoint → contadores
type HourBucket = Map<string, { total: number; e429: number; byCaller: Map<string, number> }>;
const hourly = new Map<number, HourBucket>();
const HOURS_KEPT = 48;

function normalizeEndpoint(input: string | URL): string {
  const raw = typeof input === "string" ? input : input.toString();
  if (raw.includes("accounts.spotify.com")) return "token";
  try {
    const u = new URL(raw);
    // IDs base62 de 22 chars → {id}; listas de ids na query são ignoradas (path já basta)
    return u.pathname.replace(/\/v1/, "").replace(/[A-Za-z0-9]{22}/g, "{id}") || "/";
  } catch {
    return raw.slice(0, 60);
  }
}

/** Melhor esforço: primeiro frame do stack fora deste módulo/spotify-server. */
function detectCaller(): string {
  const stack = new Error().stack ?? "";
  for (const line of stack.split("\n").slice(1)) {
    if (
      line.includes("spotify-usage-log") ||
      line.includes("spotify-server") ||
      line.includes("node:internal") ||
      !line.trim().startsWith("at ")
    ) {
      continue;
    }
    // "at funcName (path:l:c)" → funcName; "at path:l:c" → último segmento do path
    const m = line.trim().match(/^at\s+(?:async\s+)?([^(\s]+)\s*\(?([^)]*)\)?$/);
    if (!m) continue;
    const fn = m[1];
    if (fn && !fn.startsWith("/") && !fn.includes("\\") && fn !== "Object.<anonymous>") {
      return fn.slice(0, 80);
    }
    const loc = (m[2] || fn || "").split(/[\\/]/).pop() ?? "";
    if (loc) return loc.replace(/:\d+:\d+$/, "").slice(0, 80);
  }
  return "desconhecido";
}

function pruneHourly() {
  const cutoff = Math.floor(Date.now() / 3_600_000) - HOURS_KEPT;
  for (const key of hourly.keys()) {
    if (key < cutoff) hourly.delete(key);
  }
}

export function recordSpotifyCall(opts: {
  input: string | URL;
  app: SpotifyCallRecord["app"];
  status: number | null;
  retryAfterS?: number | null;
  caller?: string;
  endpointOverride?: string;
}): void {
  try {
    const rec: SpotifyCallRecord = {
      ts: Date.now(),
      endpoint: opts.endpointOverride ?? normalizeEndpoint(opts.input),
      app: opts.app,
      status: opts.status,
      retryAfterS: opts.retryAfterS ?? null,
      caller: opts.caller ?? detectCaller(),
    };

    records.push(rec);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);

    const hourKey = Math.floor(rec.ts / 3_600_000);
    let bucket = hourly.get(hourKey);
    if (!bucket) {
      bucket = new Map();
      hourly.set(hourKey, bucket);
      pruneHourly();
    }
    let entry = bucket.get(rec.endpoint);
    if (!entry) {
      entry = { total: 0, e429: 0, byCaller: new Map() };
      bucket.set(rec.endpoint, entry);
    }
    entry.total += 1;
    if (rec.status === 429) entry.e429 += 1;
    entry.byCaller.set(rec.caller, (entry.byCaller.get(rec.caller) ?? 0) + 1);
  } catch {
    // log nunca pode quebrar o fluxo principal
  }
}

export type SpotifyUsageSummary = {
  since: number;
  totalCalls: number;
  total429: number;
  byEndpoint: { endpoint: string; total: number; e429: number; topCallers: { caller: string; count: number }[] }[];
  byHour: { hourIso: string; total: number; e429: number }[];
  recent429s: SpotifyCallRecord[];
  recentCalls: SpotifyCallRecord[];
};

export function getSpotifyUsageSummary(hours = 24): SpotifyUsageSummary {
  const sinceHour = Math.floor(Date.now() / 3_600_000) - hours;
  const since = sinceHour * 3_600_000;

  const endpointAgg = new Map<string, { total: number; e429: number; byCaller: Map<string, number> }>();
  const byHour: { hourIso: string; total: number; e429: number }[] = [];

  for (const [hourKey, bucket] of [...hourly.entries()].sort((a, b) => a[0] - b[0])) {
    if (hourKey < sinceHour) continue;
    let hTotal = 0;
    let h429 = 0;
    for (const [endpoint, entry] of bucket) {
      hTotal += entry.total;
      h429 += entry.e429;
      let agg = endpointAgg.get(endpoint);
      if (!agg) {
        agg = { total: 0, e429: 0, byCaller: new Map() };
        endpointAgg.set(endpoint, agg);
      }
      agg.total += entry.total;
      agg.e429 += entry.e429;
      for (const [caller, count] of entry.byCaller) {
        agg.byCaller.set(caller, (agg.byCaller.get(caller) ?? 0) + count);
      }
    }
    byHour.push({ hourIso: new Date(hourKey * 3_600_000).toISOString(), total: hTotal, e429: h429 });
  }

  const byEndpoint = [...endpointAgg.entries()]
    .map(([endpoint, agg]) => ({
      endpoint,
      total: agg.total,
      e429: agg.e429,
      topCallers: [...agg.byCaller.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([caller, count]) => ({ caller, count })),
    }))
    .sort((a, b) => b.total - a.total);

  const inWindow = records.filter((r) => r.ts >= since);

  return {
    since,
    totalCalls: inWindow.length,
    total429: inWindow.filter((r) => r.status === 429).length,
    byEndpoint,
    byHour,
    recent429s: inWindow.filter((r) => r.status === 429).slice(-30).reverse(),
    recentCalls: inWindow.slice(-50).reverse(),
  };
}
