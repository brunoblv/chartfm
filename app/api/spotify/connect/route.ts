import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import crypto from "crypto";
import { authOptions } from "@/lib/auth-options";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyUserConnectRedirectUri,
  spotifyUserOAuthConfigured,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_connect_state";

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
  const redirectUri = getSpotifyUserConnectRedirectUri(new URL(req.url).origin);
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, redirectUri));
}
