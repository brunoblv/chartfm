import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureCanonicalAppOrigin, ensureDevLocalhostRedirect } from "@/lib/app-url";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  localeFromAcceptLanguage,
} from "@/lib/i18n/config";
import {
  MAINTENANCE_PATH,
  MAINTENANCE_BYPASS_COOKIE,
  hasMaintenanceBypass,
  isMaintenanceModeEnabled,
  isMaintenancePath,
  isMaintenanceStaticAsset,
  maintenanceBypassSecret,
} from "@/lib/maintenance";

function isRscOrPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.has("next-router-state-tree")
  );
}

function ensureLocaleCookie(request: NextRequest, extraHeaders?: Headers): NextResponse {
  const nextOptions = extraHeaders ? { request: { headers: extraHeaders } } : undefined;
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existingLocale)) {
    return NextResponse.next(nextOptions);
  }

  const response = NextResponse.next(nextOptions);
  const detected = localeFromAcceptLanguage(request.headers.get("accept-language"));
  response.cookies.set(LOCALE_COOKIE, detected, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

type ApiCallSource = "user" | "system" | "anonymous";

function shouldLogApiCall(pathname: string): boolean {
  return pathname.startsWith("/api") && pathname !== "/api/internal/log-request";
}

/**
 * Registra toda chamada de API (ver app/admin/logs) — quem fez, quando, e se
 * é o próprio sistema (cron) chamando. O middleware roda em edge runtime e não
 * pode falar com o Prisma diretamente, então delega a escrita a uma rota Node
 * (/api/internal/log-request) via fetch "fire and forget" (event.waitUntil).
 * O status de erro real (crash/exceção) é preenchido depois por
 * instrumentation.ts:onRequestError, correlacionado pelo header x-log-id.
 */
function classifyApiCall(
  request: NextRequest,
  token: { prismaUserId?: string; name?: string; handle?: string } | null,
): {
  source: ApiCallSource;
  trigger: "manual" | "automatic";
  userId: string | null;
  userName: string | null;
  userHandle: string | null;
} {
  const secret = process.env.CRON_SECRET;
  const isSystem = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  const source: ApiCallSource = isSystem ? "system" : token?.prismaUserId ? "user" : "anonymous";
  return {
    source,
    // Cron/sistema = automática; clique de usuário (ou visitante) = manual.
    trigger: source === "system" ? "automatic" : "manual",
    userId: token?.prismaUserId ?? null,
    userName: token?.name ?? null,
    userHandle: token?.handle ?? null,
  };
}

function logApiCall(
  request: NextRequest,
  event: NextFetchEvent,
  token: { prismaUserId?: string; name?: string; handle?: string } | null,
): { id: string; meta: ReturnType<typeof classifyApiCall> } {
  const id = crypto.randomUUID();
  const secret = process.env.CRON_SECRET;
  const meta = classifyApiCall(request, token);

  const payload = {
    id,
    method: request.method,
    path: request.nextUrl.pathname,
    source: meta.source,
    userId: meta.userId,
    userName: meta.userName,
    userHandle: meta.userHandle,
  };

  const logUrl = new URL("/api/internal/log-request", request.nextUrl.origin);
  event.waitUntil(
    fetch(logUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => null),
  );

  return { id, meta };
}

/** Redireciona visitantes para /manutencao quando MAINTENANCE_MODE está ativo. */
function handleMaintenance(request: NextRequest): NextResponse | null {
  if (!isMaintenanceModeEnabled()) return null;

  const pathname = request.nextUrl.pathname;
  if (isMaintenanceStaticAsset(pathname) || isMaintenancePath(pathname)) return null;

  const secret = maintenanceBypassSecret();
  const bypassParam = request.nextUrl.searchParams.get("bypass");

  if (secret && bypassParam === secret) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("bypass");
    const response = NextResponse.redirect(clean);
    response.cookies.set(MAINTENANCE_BYPASS_COOKIE, secret, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
    });
    return response;
  }

  if (hasMaintenanceBypass(request)) return null;

  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;
  url.search = "";
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Retry-After", "120");
  return response;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const isOAuthConnect =
    pathname.startsWith("/api/spotify/connect") ||
    pathname.startsWith("/api/youtube/connect");
  // /login inicia o fluxo do Google (cookies de state/pkce). Se o host não estiver
  // canonicalizado antes do clique, o cookie setado em /api/auth/signin é do host
  // errado e não bate com o redirect_uri do callback -> falha na 1a tentativa.
  const isAuthFlow = pathname === "/login";

  const devLocalRedirect = ensureDevLocalhostRedirect(request);
  if (devLocalRedirect) return devLocalRedirect;

  const canonicalRedirect = ensureCanonicalAppOrigin(request);
  if (canonicalRedirect) return canonicalRedirect;

  const maintenanceRedirect = handleMaintenance(request);
  if (maintenanceRedirect) return maintenanceRedirect;

  if (isOAuthConnect || isAuthFlow) {
    return NextResponse.next();
  }

  // RSC/prefetch dispara dezenas de requisições paralelas; evitar getToken em cada uma.
  if (isRscOrPrefetch(request)) {
    return ensureLocaleCookie(request);
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Rotas de API devem responder com JSON/erro, nunca com redirect — a própria
  // página de onboarding depende de /api/user/handle e /api/user/genres para
  // funcionar enquanto needsHandle ainda é true.
  if (token?.needsHandle && token.prismaUserId && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (shouldLogApiCall(pathname)) {
    const { id: logId, meta } = logApiCall(request, event, {
      prismaUserId: token?.prismaUserId as string | undefined,
      name: token?.name as string | undefined,
      handle: token?.handle as string | undefined,
    });
    const headersWithLogId = new Headers(request.headers);
    headersWithLogId.set("x-log-id", logId);
    // Contexto para logs de APIs externas (Spotify etc.) — lido em lib/api-call-context.ts
    headersWithLogId.set("x-api-source", meta.source);
    headersWithLogId.set("x-api-trigger", meta.trigger);
    headersWithLogId.set("x-api-path", pathname);
    if (meta.userName) headersWithLogId.set("x-api-user-name", meta.userName);
    if (meta.userHandle) headersWithLogId.set("x-api-user-handle", meta.userHandle);
    return ensureLocaleCookie(request, headersWithLogId);
  }

  return ensureLocaleCookie(request);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/api/spotify/:path*",
    "/api/youtube/:path*",
    "/login",
    "/((?!api|_next/static|_next/image|favicon\\.ico|manutencao|login|signup|forgot-password|reset-password|verify-email|onboarding|public).*)",
  ],
};
