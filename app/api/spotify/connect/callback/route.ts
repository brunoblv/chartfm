import { NextRequest, NextResponse } from "next/server";
import { appPathUrl, ensureCanonicalAppOrigin } from "@/lib/app-url";
import { canUseSpotifyFeatures } from "@/lib/mytrl-access";
import { prisma } from "@/lib/prisma";
import { parseSpotifyConnectState } from "@/lib/spotify-connect-oauth";
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
function withSpotifyParam(returnTo: string, status: string, reason?: string | null): URL {
  const dest = appPathUrl(returnTo);
  dest.searchParams.set("spotify", status);
  if (reason) dest.searchParams.set("spotify_reason", reason);
  return dest;
}

// GET /api/spotify/connect/callback — retorno do OAuth Spotify para usuários comuns
export async function GET(req: NextRequest) {
  const canonicalRedirect = ensureCanonicalAppOrigin(req);
  if (canonicalRedirect) return canonicalRedirect;

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const returnToDefault = "/settings";

  if (error) {
    const status = error === "access_denied" ? "access_denied" : "error";
    return NextResponse.redirect(withSpotifyParam(returnToDefault, status, error));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verified = state ? parseSpotifyConnectState(state) : null;
  const returnTo = resolveReturnTo(verified?.from);

  if (!code || !verified) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "invalid_state"));
  }

  const owner = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, handle: true, spotifyRefreshToken: true },
  });
  if (!owner || !canUseSpotifyFeatures(owner.handle)) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "invalid_state"));
  }

  const tokens = await exchangeSpotifyAuthCode(code, verified.redirectUri);
  if (!tokens) {
    console.error("[spotify/connect/callback] token exchange failed", {
      redirectUri: verified.redirectUri,
      userId: owner.id,
    });
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error"));
  }

  const me = await fetchSpotifyMeStatus(tokens.access_token);
  if (me.status === 403) {
    console.warn("[spotify/connect/callback] user not on Spotify app allowlist", { userId: owner.id });
    return NextResponse.redirect(withSpotifyParam(returnTo, "not_registered"));
  }
  if (!me.ok) {
    console.error("[spotify/connect/callback] /me failed", { status: me.status, userId: owner.id });
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error"));
  }

  if (!tokens.refresh_token && !owner.spotifyRefreshToken) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "no_refresh_token"));
  }

  await saveUserSpotifyTokens(owner.id, tokens);
  return NextResponse.redirect(withSpotifyParam(returnTo, "connected"));
}
