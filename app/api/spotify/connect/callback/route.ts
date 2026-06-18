import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { appPathUrl, ensureCanonicalAppOrigin, getAppOrigin } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { verifySpotifyConnectState } from "@/lib/spotify-connect-oauth";
import {
  exchangeSpotifyAuthCode,
  fetchSpotifyMeStatus,
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
  const canonicalRedirect = ensureCanonicalAppOrigin(req);
  if (canonicalRedirect) return canonicalRedirect;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(appPathUrl("/login", getAppOrigin(new URL(req.url).origin)));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const returnToDefault = "/settings";

  if (error) {
    const status = error === "access_denied" ? "access_denied" : "error";
    return NextResponse.redirect(withSpotifyParam(returnToDefault, status, req, error));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verified = state ? verifySpotifyConnectState(state, session.user.id) : null;
  const returnTo = resolveReturnTo(verified?.from);

  if (!code || !verified) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "invalid_state", req));
  }

  const tokens = await exchangeSpotifyAuthCode(code, verified.redirectUri);
  if (!tokens) {
    console.error("[spotify/connect/callback] token exchange failed", {
      redirectUri: verified.redirectUri,
      userId: session.user.id,
    });
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error", req));
  }

  const me = await fetchSpotifyMeStatus(tokens.access_token);
  if (me.status === 403) {
    console.warn("[spotify/connect/callback] user not on Spotify app allowlist", { userId: session.user.id });
    return NextResponse.redirect(withSpotifyParam(returnTo, "not_registered", req));
  }
  if (!me.ok) {
    console.error("[spotify/connect/callback] /me failed", { status: me.status, userId: session.user.id });
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error", req));
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { spotifyRefreshToken: true },
  });
  if (!tokens.refresh_token && !existing?.spotifyRefreshToken) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "no_refresh_token", req));
  }

  await saveUserSpotifyTokens(session.user.id, tokens);
  return NextResponse.redirect(withSpotifyParam(returnTo, "connected", req));
}
