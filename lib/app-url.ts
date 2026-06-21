import { NextRequest, NextResponse } from "next/server";

/**
 * URL pública da aplicação para redirects.
 * Preferir NEXTAUTH_URL — req.url pode vir com host/proto errados (proxy, localhost, etc.).
 */
export function getAppOrigin(requestOrigin?: string): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const raw = requestOrigin?.replace(/\/$/, "") || "http://127.0.0.1:3000";
  return raw.replace(/^http:\/\/localhost(?=:\d+|\/|$)/i, "http://127.0.0.1");
}

export function appPathUrl(path: string, requestOrigin?: string): URL {
  const base = getAppOrigin(requestOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${base}/`);
}

/**
 * Em dev, alinha `localhost` com `127.0.0.1` (NEXTAUTH_URL) para cookies de sessão
 * funcionarem em `/create` e nas rotas `/api/*`.
 */
export function ensureDevLocalhostRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === "production") return null;

  const canonical = getAppOrigin();
  const current = new URL(req.url);
  const canonicalUrl = new URL(`${canonical}/`);

  if (current.hostname !== "localhost" || canonicalUrl.hostname === "localhost") {
    return null;
  }

  const dest = new URL(req.url);
  dest.hostname = canonicalUrl.hostname;
  if (canonicalUrl.port) dest.port = canonicalUrl.port;
  return NextResponse.redirect(dest.href, 307);
}

/** Redireciona www → domínio canônico (NEXTAUTH_URL) para cookies e OAuth funcionarem. */
export function ensureCanonicalAppOrigin(req: NextRequest): NextResponse | null {
  const canonical = getAppOrigin();
  const current = new URL(req.url);
  const canonicalUrl = new URL(`${canonical}/`);

  if (current.hostname === canonicalUrl.hostname) return null;

  const wwwPair =
    current.hostname === `www.${canonicalUrl.hostname}` ||
    canonicalUrl.hostname === `www.${current.hostname}`;
  if (!wwwPair) return null;

  const dest = new URL(req.url);
  dest.protocol = canonicalUrl.protocol;
  dest.hostname = canonicalUrl.hostname;
  if (canonicalUrl.port) dest.port = canonicalUrl.port;
  return NextResponse.redirect(dest, 308);
}
