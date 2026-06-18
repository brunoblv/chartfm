import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureCanonicalAppOrigin } from "@/lib/app-url";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  localeFromAcceptLanguage,
} from "@/lib/i18n/config";

export async function middleware(request: NextRequest) {
  const canonicalRedirect = ensureCanonicalAppOrigin(request);
  if (canonicalRedirect) return canonicalRedirect;

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (token?.needsHandle && token.prismaUserId) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

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

export const config = {
  matcher: [
    "/api/spotify/:path*",
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|onboarding|public).*)",
  ],
};
