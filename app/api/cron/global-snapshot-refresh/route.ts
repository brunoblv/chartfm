import { NextRequest, NextResponse } from "next/server";
import { refreshRankingWeekSnapshot } from "@/lib/global-snapshot";
import { refreshAllGlobalLastfmSnapshots } from "@/lib/global-lastfm-snapshot";
import { syncGlobal100YouTubePlaylist, syncGlobalAirplayYouTubePlaylist } from "@/lib/youtube-user";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const snapshot = await refreshRankingWeekSnapshot(now);
  const lastfm = await refreshAllGlobalLastfmSnapshots(now);

  // Cria playlists YouTube se ainda não existem para esta semana (fire-and-forget).
  syncGlobal100YouTubePlaylist(snapshot.weekIndex, snapshot.weekLabel).catch((e) =>
    console.error("[cron] syncGlobal100YouTube error", e),
  );
  syncGlobalAirplayYouTubePlaylist(lastfm.airplay.weekIndex, lastfm.airplay.weekLabel).catch((e) =>
    console.error("[cron] syncGlobalAirplayYouTube error", e),
  );

  return NextResponse.json({
    ok: true,
    weekIndex: snapshot.weekIndex,
    weekLabel: snapshot.weekLabel,
    dateRange: snapshot.dateRange,
    lastfmAirplayWeek: lastfm.airplay.weekIndex,
    lastfmAlbumsWeek: lastfm.albums.weekIndex,
  });
}
