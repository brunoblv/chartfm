import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { buildSpotifyAuthorizeUrl, spotifyUserOAuthConfigured } from "@/lib/spotify-user";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_oauth_state";

// GET /api/spotify/auth — inicia OAuth Spotify (somente @bruno)
export async function GET() {
  const session = await requireMyTrlSession();
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
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state));
}
