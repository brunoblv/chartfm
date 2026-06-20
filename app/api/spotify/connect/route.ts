import { NextRequest, NextResponse } from "next/server";
import { appPathUrl, ensureCanonicalAppOrigin, getAppOrigin } from "@/lib/app-url";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import { prisma } from "@/lib/prisma";
import { createSpotifyConnectState } from "@/lib/spotify-connect-oauth";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyUserConnectRedirectUri,
  spotifyUserOAuthConfigured,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

/** Aceita apenas caminhos relativos internos (evita open redirect). */
function sanitizeFrom(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// GET /api/spotify/connect — inicia OAuth Spotify (somente @bruno)
export async function GET(req: NextRequest) {
  const canonicalRedirect = ensureCanonicalAppOrigin(req);
  if (canonicalRedirect) return canonicalRedirect;

  const session = await requireMyTrlSession(req);
  if (!session?.user?.id) {
    const from = sanitizeFrom(new URL(req.url).searchParams.get("from")) ?? "/settings";
    const login = appPathUrl("/login");
    login.searchParams.set("from", from);
    return NextResponse.redirect(login);
  }

  if (!spotifyUserOAuthConfigured()) {
    return NextResponse.json(
      { error: "Spotify OAuth não configurado (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const redirectUri = getSpotifyUserConnectRedirectUri(getAppOrigin());
  const from = sanitizeFrom(new URL(req.url).searchParams.get("from"));
  const reconnect = new URL(req.url).searchParams.get("reconnect") === "1";

  // Spotify não renova refresh_token nem escopos em reautorização — limpar antes de pedir novos.
  if (reconnect) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyTokenExpiresAt: null,
        spotifyUserId: null,
      },
    });
  }

  const state = createSpotifyConnectState(session.user.id, redirectUri, from ?? undefined);

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, redirectUri));
}
