import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyRedirectUri,
  spotifyUserOAuthConfigured,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_oauth_state";
const REDIRECT_URI_COOKIE = "spotify_oauth_redirect_uri";

// GET /api/spotify/auth — inicia OAuth Spotify (somente @bruno)
export async function GET(req: NextRequest) {
  const session = await requireMyTrlSession(req);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!spotifyUserOAuthConfigured()) {
    return NextResponse.json(
      { error: "Spotify OAuth não configurado (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getSpotifyRedirectUri(new URL(req.url).origin);
  const jar = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  jar.set(STATE_COOKIE, state, cookieOpts);
  jar.set(REDIRECT_URI_COOKIE, redirectUri, cookieOpts);

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, redirectUri));
}
