import { NextRequest, NextResponse } from "next/server";
import { ensureCanonicalAppOrigin, getAppOrigin } from "@/lib/app-url";
import { requireMyTrlSession } from "@/lib/mytrl-access";
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

  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!spotifyUserOAuthConfigured()) {
    return NextResponse.json(
      { error: "Spotify OAuth não configurado (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const redirectUri = getSpotifyUserConnectRedirectUri(getAppOrigin(new URL(req.url).origin));
  const from = sanitizeFrom(new URL(req.url).searchParams.get("from"));
  const state = createSpotifyConnectState(session.user.id, redirectUri, from ?? undefined);

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, redirectUri));
}
