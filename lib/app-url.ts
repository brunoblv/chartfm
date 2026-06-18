import { NextRequest, NextResponse } from "next/server";

/**
 * URL pública da aplicação para redirects.
 * Preferir NEXTAUTH_URL — req.url pode vir com host/proto errados (proxy, localhost, etc.).
 */
export function getAppOrigin(requestOrigin?: string): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  const raw = fromEnv || requestOrigin?.replace(/\/$/, "") || "http://127.0.0.1:3000";
  return raw.replace(/^http:\/\/localhost(?=:\d+|\/|$)/i, "http://127.0.0.1");
}

export function appPathUrl(path: string, requestOrigin?: string): URL {
  const base = getAppOrigin(requestOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${base}/`);
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
  return NextResponse.redirect(dest, 308);
}
