import { NextResponse } from "next/server";

/**
 * Rate limiter simples em memória (janela fixa). A app roda em processo único
 * (`next start` na VPS), então um Map em memória é suficiente e evita ida ao
 * banco a cada tentativa. Se um dia escalar para múltiplas instâncias, trocar
 * por um store compartilhado (Redis/Postgres).
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Remove buckets expirados de tempos em tempos para o Map não crescer sem limite. */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Registra um acesso e diz se está dentro do limite. `key` deve identificar o
 * cliente + a ação (ex.: `login:1.2.3.4`).
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: opts.limit - bucket.count, retryAfterSec: 0 };
}

/** Extrai o IP do cliente atrás do proxy reverso da VPS. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Resposta 429 padrão com header Retry-After. */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/**
 * Aplica rate limit por IP a uma rota. Retorna uma resposta 429 quando o limite
 * é estourado, ou `null` quando a requisição pode prosseguir.
 */
export function enforceIpRateLimit(
  req: Request,
  action: string,
  opts: { limit: number; windowMs: number },
): NextResponse | null {
  const result = rateLimit(`${action}:${clientIp(req)}`, opts);
  if (!result.allowed) return tooManyRequests(result.retryAfterSec);
  return null;
}
