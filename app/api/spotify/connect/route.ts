import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import crypto from "crypto";
import { authOptions } from "@/lib/auth-options";
import { getAppOrigin } from "@/lib/app-url";
import {
  SPOTIFY_CONNECT_COOKIE_OPTS,
  SPOTIFY_CONNECT_FROM_COOKIE,
  SPOTIFY_CONNECT_REDIRECT_URI_COOKIE,
  SPOTIFY_CONNECT_STATE_COOKIE,
} from "@/lib/spotify-connect-oauth";
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

// GET /api/spotify/connect — inicia OAuth Spotify para qualquer usuário autenticado
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!spotifyUserOAuthConfigured()) {
    return NextResponse.json(
      { error: "Spotify OAuth não configurado (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getSpotifyUserConnectRedirectUri(getAppOrigin(new URL(req.url).origin));
  const from = sanitizeFrom(new URL(req.url).searchParams.get("from"));
  const jar = await cookies();
  jar.set(SPOTIFY_CONNECT_STATE_COOKIE, state, SPOTIFY_CONNECT_COOKIE_OPTS);
  jar.set(SPOTIFY_CONNECT_REDIRECT_URI_COOKIE, redirectUri, SPOTIFY_CONNECT_COOKIE_OPTS);
  if (from) {
    jar.set(SPOTIFY_CONNECT_FROM_COOKIE, from, SPOTIFY_CONNECT_COOKIE_OPTS);
  } else {
    jar.delete(SPOTIFY_CONNECT_FROM_COOKIE);
  }

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, redirectUri));
}
