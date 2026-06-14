import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";
import {
  exchangeSpotifyAuthCode,
  getSpotifyRedirectUri,
  saveSpotifyConnection,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_oauth_state";
const REDIRECT_URI_COOKIE = "spotify_oauth_redirect_uri";

// GET /api/spotify/callback — retorno do OAuth Spotify
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.handle || session.user.handle !== MYTRL_OWNER_HANDLE || !session.user.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/mytrl?spotify=error&reason=${encodeURIComponent(error)}`, req.url));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value;
  const storedRedirectUri = jar.get(REDIRECT_URI_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  jar.delete(REDIRECT_URI_COOKIE);

  if (!code || !state || !stored || state !== stored) {
    return NextResponse.redirect(new URL("/mytrl?spotify=invalid_state", req.url));
  }

  const redirectUri =
    storedRedirectUri ?? getSpotifyRedirectUri(new URL(req.url).origin);
  const tokens = await exchangeSpotifyAuthCode(code, redirectUri);
  if (!tokens) {
    return NextResponse.redirect(new URL("/mytrl?spotify=token_error", req.url));
  }

  const result = await saveSpotifyConnection(session.user.id, tokens);
  const qs = result.playlistFound ? "connected" : "connected_no_playlist";
  return NextResponse.redirect(new URL(`/mytrl?spotify=${qs}`, req.url));
}
