import { NextRequest, NextResponse } from "next/server";
import { appPathUrl, ensureCanonicalAppOrigin } from "@/lib/app-url";
import { isMyTrlOwner } from "@/lib/mytrl-access";
import { prisma } from "@/lib/prisma";
import { parseYouTubeConnectState } from "@/lib/youtube-connect-oauth";
import {
  exchangeYouTubeAuthCode,
  saveYouTubeConnection,
} from "@/lib/youtube-user";

export const runtime = "nodejs";

function resolveReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/settings";
}

function withYouTubeParam(returnTo: string, status: string, reason?: string | null): URL {
  const dest = appPathUrl(returnTo);
  dest.searchParams.set("youtube", status);
  if (reason) dest.searchParams.set("youtube_reason", reason);
  return dest;
}

// GET /api/youtube/connect/callback
export async function GET(req: NextRequest) {
  const canonicalRedirect = ensureCanonicalAppOrigin(req);
  if (canonicalRedirect) return canonicalRedirect;

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const returnToDefault = "/settings";

  if (error) {
    const status = error === "access_denied" ? "access_denied" : "error";
    return NextResponse.redirect(withYouTubeParam(returnToDefault, status, error));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verified = state ? parseYouTubeConnectState(state) : null;
  const returnTo = resolveReturnTo(verified?.from);

  if (!code || !verified) {
    return NextResponse.redirect(withYouTubeParam(returnTo, "invalid_state"));
  }

  const owner = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, handle: true, youtubeRefreshToken: true },
  });
  if (!owner || !isMyTrlOwner(owner.handle)) {
    return NextResponse.redirect(withYouTubeParam(returnTo, "invalid_state"));
  }

  const tokens = await exchangeYouTubeAuthCode(code, verified.redirectUri);
  if (!tokens) {
    return NextResponse.redirect(withYouTubeParam(returnTo, "token_error"));
  }

  if (!tokens.refresh_token && !owner.youtubeRefreshToken) {
    return NextResponse.redirect(withYouTubeParam(returnTo, "no_refresh_token"));
  }

  const result = await saveYouTubeConnection(owner.id, tokens);
  if (!result.isChartFm) {
    return NextResponse.redirect(withYouTubeParam(returnTo, "wrong_channel"));
  }

  return NextResponse.redirect(withYouTubeParam(returnTo, "connected"));
}
