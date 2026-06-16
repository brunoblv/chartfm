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
