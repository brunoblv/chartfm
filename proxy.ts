import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureCanonicalAppOrigin, ensureDevLocalhostRedirect } from "@/lib/app-url";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  localeFromAcceptLanguage,
} from "@/lib/i18n/config";

function isRscOrPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.has("next-router-state-tree")
  );
}

function ensureLocaleCookie(request: NextRequest): NextResponse {
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existingLocale)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const detected = localeFromAcceptLanguage(request.headers.get("accept-language"));
  response.cookies.set(LOCALE_COOKIE, detected, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isOAuthConnect =
    pathname.startsWith("/api/spotify/connect") ||
    pathname.startsWith("/api/youtube/connect");

  const devLocalRedirect = ensureDevLocalhostRedirect(request);
  if (devLocalRedirect) return devLocalRedirect;

  const canonicalRedirect = ensureCanonicalAppOrigin(request);
  if (canonicalRedirect) return canonicalRedirect;

  if (isOAuthConnect) {
    return NextResponse.next();
  }

  // RSC/prefetch dispara dezenas de requisições paralelas; evitar getToken em cada uma.
  if (isRscOrPrefetch(request)) {
    return ensureLocaleCookie(request);
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (token?.needsHandle && token.prismaUserId) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return ensureLocaleCookie(request);
}

export const config = {
  matcher: [
    "/api/spotify/:path*",
    "/api/youtube/:path*",
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|onboarding|public).*)",
  ],
};
