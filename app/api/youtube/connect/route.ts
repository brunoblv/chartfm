import { NextRequest, NextResponse } from "next/server";
import { appPathUrl, ensureCanonicalAppOrigin, getAppOrigin } from "@/lib/app-url";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import { createYouTubeConnectState } from "@/lib/youtube-connect-oauth";
import {
  buildYouTubeAuthorizeUrl,
  getYouTubeRedirectUri,
  youtubeOAuthConfigured,
} from "@/lib/youtube-user";

export const runtime = "nodejs";

function sanitizeFrom(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// GET /api/youtube/connect — OAuth YouTube do canal @chartFM (somente @bruno)
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

  if (!youtubeOAuthConfigured()) {
    return NextResponse.json(
      { error: "YouTube OAuth não configurado (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const redirectUri = getYouTubeRedirectUri(getAppOrigin());
  const from = sanitizeFrom(new URL(req.url).searchParams.get("from"));
  const state = createYouTubeConnectState(session.user.id, redirectUri, from ?? undefined);

  return NextResponse.redirect(buildYouTubeAuthorizeUrl(state, redirectUri));
}
