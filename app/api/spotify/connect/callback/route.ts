import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import { appPathUrl, getAppOrigin } from "@/lib/app-url";
import {
  SPOTIFY_CONNECT_FROM_COOKIE,
  SPOTIFY_CONNECT_REDIRECT_URI_COOKIE,
  SPOTIFY_CONNECT_STATE_COOKIE,
} from "@/lib/spotify-connect-oauth";
import {
  exchangeSpotifyAuthCode,
  getSpotifyUserConnectRedirectUri,
  saveUserSpotifyTokens,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

/** Página de retorno (sanitizada na rota de início); padrão: /settings. */
function resolveReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/settings";
}

/** Anexa `spotify=<status>` preservando query existente do caminho de retorno. */
function withSpotifyParam(returnTo: string, status: string, req: NextRequest, reason?: string | null): URL {
  const dest = appPathUrl(returnTo, getAppOrigin(new URL(req.url).origin));
  dest.searchParams.set("spotify", status);
  if (reason) dest.searchParams.set("spotify_reason", reason);
  return dest;
}

// GET /api/spotify/connect/callback — retorno do OAuth Spotify para usuários comuns
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const jar = await cookies();
  const returnTo = resolveReturnTo(jar.get(SPOTIFY_CONNECT_FROM_COOKIE)?.value);
  jar.delete(SPOTIFY_CONNECT_FROM_COOKIE);

  if (!session?.user?.id) {
    return NextResponse.redirect(appPathUrl("/login", getAppOrigin(new URL(req.url).origin)));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    const status = error === "access_denied" ? "access_denied" : "error";
    return NextResponse.redirect(withSpotifyParam(returnTo, status, req, error));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = jar.get(SPOTIFY_CONNECT_STATE_COOKIE)?.value;
  const storedRedirectUri = jar.get(SPOTIFY_CONNECT_REDIRECT_URI_COOKIE)?.value;
  jar.delete(SPOTIFY_CONNECT_STATE_COOKIE);
  jar.delete(SPOTIFY_CONNECT_REDIRECT_URI_COOKIE);

  if (!code || !state || !stored || state !== stored) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "invalid_state", req));
  }

  const redirectUri =
    storedRedirectUri ?? getSpotifyUserConnectRedirectUri(getAppOrigin(new URL(req.url).origin));
  const tokens = await exchangeSpotifyAuthCode(code, redirectUri);
  if (!tokens) {
    console.error("[spotify/connect/callback] token exchange failed", { redirectUri, userId: session.user.id });
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error", req));
  }

  await saveUserSpotifyTokens(session.user.id, tokens);
  return NextResponse.redirect(withSpotifyParam(returnTo, "connected", req));
}
