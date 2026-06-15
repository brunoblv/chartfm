import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import {
  exchangeSpotifyAuthCode,
  getSpotifyUserConnectRedirectUri,
  saveUserSpotifyTokens,
} from "@/lib/spotify-user";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_connect_state";

// GET /api/spotify/connect/callback — retorno do OAuth Spotify para usuários comuns
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?spotify=error&reason=${encodeURIComponent(error)}`, req.url),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !stored || state !== stored) {
    return NextResponse.redirect(new URL("/settings?spotify=invalid_state", req.url));
  }

  const redirectUri = getSpotifyUserConnectRedirectUri(new URL(req.url).origin);
  const tokens = await exchangeSpotifyAuthCode(code, redirectUri);
  if (!tokens) {
    return NextResponse.redirect(new URL("/settings?spotify=token_error", req.url));
  }

  await saveUserSpotifyTokens(session.user.id, tokens);
  return NextResponse.redirect(new URL("/settings?spotify=connected", req.url));
}
