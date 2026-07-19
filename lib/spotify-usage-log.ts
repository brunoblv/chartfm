/**
 * Log de uso da API do Spotify — registra toda chamada feita via spotifyFetch
 * (e a entrega de tokens ao browser) para diagnosticar de onde vem o consumo.
 *
 * Em memória (ring buffer + agregados por hora); zera no restart do pm2, o que
 * é aceitável: o objetivo é diagnóstico das últimas horas, não auditoria.
 *
 * Contexto (quem pediu / manual vs automática) vem de lib/api-call-context.ts
 * quando a chamada roda dentro de uma request HTTP.
 */

export type ApiCallContext = {
  who: string;
  trigger: "manual" | "automatic";
  path?: string | null;
  source?: string | null;
};

export type SpotifyCallRecord = {
  ts: number;
  endpoint: string; // normalizado: /search, /tracks/{id}, token, browser-token, ...
  app: "primary" | "backup" | "backup2" | "backup3" | "token" | "browser";
  status: number | null; // null = falha de rede/timeout
  retryAfterS: number | null;
  caller: string; // função/arquivo de origem (melhor esforço via stack)
  who: string;
  trigger: "manual" | "automatic";
  path: string | null;
  durationMs: number | null;
};

const MAX_RECORDS = 2000;
const records: SpotifyCallRecord[] = [];

// Agregado por hora (chave = epoch-hora) → por endpoint → contadores
type HourBucket = Map<
  string,
  { total: number; e429: number; byCaller: Map<string, number>; durationSum: number; durationN: number }
>;
const hourly = new Map<number, HourBucket>();
// Agregado por hora → por app (primary/backup/backup2/backup3/...) → contadores
type HourAppBucket = Map<SpotifyCallRecord["app"], { total: number; e429: number }>;
const hourlyByApp = new Map<number, HourAppBucket>();
// Agregado por hora → por quem pediu
type HourWhoBucket = Map<string, { total: number; e429: number; trigger: SpotifyCallRecord["trigger"] }>;
const hourlyByWho = new Map<number, HourWhoBucket>();
const HOURS_KEPT = 48;

let contextResolver: () => Promise<ApiCallContext | null> = async () => null;
/** Incrementa contador ALS do escopo atual (auditoria de publicação). */
let callCounterInc: (() => void) | null = null;

/** @internal — só para lib/api-call-context.ts */
export function __setApiCallContextResolver(resolver: () => Promise<ApiCallContext | null>): void {
  contextResolver = resolver;
}

/** @internal — só para lib/api-call-context.ts */
export function __setSpotifyCallCounterInc(inc: (() => void) | null): void {
  callCounterInc = inc;
}

export async function resolveApiCallContext(): Promise<ApiCallContext | null> {
  try {
    return await contextResolver();
  } catch {
    return null;
  }
}

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
  for (const key of hourlyByApp.keys()) {
    if (key < cutoff) hourlyByApp.delete(key);
  }
  for (const key of hourlyByWho.keys()) {
    if (key < cutoff) hourlyByWho.delete(key);
  }
}

export function recordSpotifyCall(opts: {
  input: string | URL;
  app: SpotifyCallRecord["app"];
  status: number | null;
  retryAfterS?: number | null;
  caller?: string;
  endpointOverride?: string;
  who?: string | null;
  trigger?: "manual" | "automatic" | null;
  path?: string | null;
  durationMs?: number | null;
}): void {
  try {
    const who = (opts.who ?? "").trim() || "Sistema / origem não identificada";
    const trigger: SpotifyCallRecord["trigger"] = opts.trigger === "manual" ? "manual" : "automatic";
    const rec: SpotifyCallRecord = {
      ts: Date.now(),
      endpoint: opts.endpointOverride ?? normalizeEndpoint(opts.input),
      app: opts.app,
      status: opts.status,
      retryAfterS: opts.retryAfterS ?? null,
      caller: opts.caller ?? detectCaller(),
      who,
      trigger,
      path: opts.path ?? null,
      durationMs: opts.durationMs ?? null,
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
      entry = { total: 0, e429: 0, byCaller: new Map(), durationSum: 0, durationN: 0 };
      bucket.set(rec.endpoint, entry);
    }
    entry.total += 1;
    if (rec.status === 429) entry.e429 += 1;
    entry.byCaller.set(rec.caller, (entry.byCaller.get(rec.caller) ?? 0) + 1);
    if (rec.durationMs != null && rec.durationMs >= 0) {
      entry.durationSum += rec.durationMs;
      entry.durationN += 1;
    }

    let appBucket = hourlyByApp.get(hourKey);
    if (!appBucket) {
      appBucket = new Map();
      hourlyByApp.set(hourKey, appBucket);
    }
    const appEntry = appBucket.get(rec.app) ?? { total: 0, e429: 0 };
    appEntry.total += 1;
    if (rec.status === 429) appEntry.e429 += 1;
    appBucket.set(rec.app, appEntry);

    let whoBucket = hourlyByWho.get(hourKey);
    if (!whoBucket) {
      whoBucket = new Map();
      hourlyByWho.set(hourKey, whoBucket);
    }
    const whoEntry = whoBucket.get(rec.who) ?? { total: 0, e429: 0, trigger: rec.trigger };
    whoEntry.total += 1;
    if (rec.status === 429) whoEntry.e429 += 1;
    whoEntry.trigger = rec.trigger;
    whoBucket.set(rec.who, whoEntry);

    try {
      callCounterInc?.();
    } catch {
      // contador de auditoria nunca pode quebrar o fluxo
    }
  } catch {
    // log nunca pode quebrar o fluxo principal
  }
}

export type SpotifyUsageSummary = {
  since: number;
  totalCalls: number;
  total429: number;
  avgDurationMs: number | null;
  byEndpoint: {
    endpoint: string;
    total: number;
    e429: number;
    avgDurationMs: number | null;
    topCallers: { caller: string; count: number }[];
  }[];
  byApp: { app: SpotifyCallRecord["app"]; total: number; e429: number }[];
  byWho: { who: string; trigger: "manual" | "automatic"; total: number; e429: number }[];
  byHour: { hourIso: string; total: number; e429: number }[];
  recent429s: SpotifyCallRecord[];
  recentCalls: SpotifyCallRecord[];
};

export function getSpotifyUsageSummary(hours = 24): SpotifyUsageSummary {
  const sinceHour = Math.floor(Date.now() / 3_600_000) - hours;
  const since = sinceHour * 3_600_000;

  const endpointAgg = new Map<
    string,
    { total: number; e429: number; byCaller: Map<string, number>; durationSum: number; durationN: number }
  >();
  const appAgg = new Map<SpotifyCallRecord["app"], { total: number; e429: number }>();
  const whoAgg = new Map<string, { total: number; e429: number; trigger: SpotifyCallRecord["trigger"] }>();
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
        agg = { total: 0, e429: 0, byCaller: new Map(), durationSum: 0, durationN: 0 };
        endpointAgg.set(endpoint, agg);
      }
      agg.total += entry.total;
      agg.e429 += entry.e429;
      agg.durationSum += entry.durationSum;
      agg.durationN += entry.durationN;
      for (const [caller, count] of entry.byCaller) {
        agg.byCaller.set(caller, (agg.byCaller.get(caller) ?? 0) + count);
      }
    }
    byHour.push({ hourIso: new Date(hourKey * 3_600_000).toISOString(), total: hTotal, e429: h429 });
  }

  for (const [hourKey, appBucket] of hourlyByApp) {
    if (hourKey < sinceHour) continue;
    for (const [app, entry] of appBucket) {
      const agg = appAgg.get(app) ?? { total: 0, e429: 0 };
      agg.total += entry.total;
      agg.e429 += entry.e429;
      appAgg.set(app, agg);
    }
  }

  for (const [hourKey, whoBucket] of hourlyByWho) {
    if (hourKey < sinceHour) continue;
    for (const [who, entry] of whoBucket) {
      const agg = whoAgg.get(who) ?? { total: 0, e429: 0, trigger: entry.trigger };
      agg.total += entry.total;
      agg.e429 += entry.e429;
      agg.trigger = entry.trigger;
      whoAgg.set(who, agg);
    }
  }

  const byEndpoint = [...endpointAgg.entries()]
    .map(([endpoint, agg]) => ({
      endpoint,
      total: agg.total,
      e429: agg.e429,
      avgDurationMs: agg.durationN > 0 ? Math.round(agg.durationSum / agg.durationN) : null,
      topCallers: [...agg.byCaller.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([caller, count]) => ({ caller, count })),
    }))
    .sort((a, b) => b.total - a.total);

  const byApp = [...appAgg.entries()]
    .map(([app, agg]) => ({ app, total: agg.total, e429: agg.e429 }))
    .sort((a, b) => b.total - a.total);

  const byWho = [...whoAgg.entries()]
    .map(([who, agg]) => ({ who, trigger: agg.trigger, total: agg.total, e429: agg.e429 }))
    .sort((a, b) => b.total - a.total);

  const inWindow = records.filter((r) => r.ts >= since);
  const withDuration = inWindow.filter((r) => r.durationMs != null && r.durationMs >= 0);
  const avgDurationMs =
    withDuration.length > 0
      ? Math.round(withDuration.reduce((s, r) => s + (r.durationMs ?? 0), 0) / withDuration.length)
      : null;

  return {
    since,
    totalCalls: inWindow.length,
    total429: inWindow.filter((r) => r.status === 429).length,
    avgDurationMs,
    byEndpoint,
    byApp,
    byWho,
    byHour,
    recent429s: inWindow.filter((r) => r.status === 429).slice(-30).reverse(),
    recentCalls: inWindow.slice(-50).reverse(),
  };
}
