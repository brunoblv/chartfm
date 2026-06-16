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
const FROM_COOKIE = "spotify_connect_from";

/** Página de retorno (sanitizada na rota de início); padrão: /settings. */
function resolveReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/settings";
}

/** Anexa `spotify=<status>` preservando query existente do caminho de retorno. */
function withSpotifyParam(returnTo: string, status: string, req: NextRequest): URL {
  const dest = new URL(returnTo, req.url);
  dest.searchParams.set("spotify", status);
  return dest;
}

// GET /api/spotify/connect/callback — retorno do OAuth Spotify para usuários comuns
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const jar = await cookies();
  const returnTo = resolveReturnTo(jar.get(FROM_COOKIE)?.value);
  jar.delete(FROM_COOKIE);

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "error", req));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !stored || state !== stored) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "invalid_state", req));
  }

  const redirectUri = getSpotifyUserConnectRedirectUri(new URL(req.url).origin);
  const tokens = await exchangeSpotifyAuthCode(code, redirectUri);
  if (!tokens) {
    return NextResponse.redirect(withSpotifyParam(returnTo, "token_error", req));
  }

  await saveUserSpotifyTokens(session.user.id, tokens);
  return NextResponse.redirect(withSpotifyParam(returnTo, "connected", req));
}
