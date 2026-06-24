import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { refreshRankingWeekSnapshot } from "@/lib/global-snapshot";
import { refreshAllGlobalLastfmSnapshots } from "@/lib/global-lastfm-snapshot";
import { syncGlobal100YouTubePlaylist, syncGlobalAirplayYouTubePlaylist } from "@/lib/youtube-user";

export const runtime = "nodejs";
export const maxDuration = 300;

/** @deprecated Sobrescreve rankings /global. Use /api/cron/publish-weekly-globals (terça 5h, congela). */
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const snapshot = await refreshRankingWeekSnapshot(now);
  const lastfm = await refreshAllGlobalLastfmSnapshots(now);

  syncGlobal100YouTubePlaylist(snapshot.weekIndex, snapshot.weekLabel).catch((e) =>
    console.error("[cron] syncGlobal100YouTube error", e),
  );
  syncGlobalAirplayYouTubePlaylist(lastfm.airplay.weekIndex, lastfm.airplay.weekLabel).catch((e) =>
    console.error("[cron] syncGlobalAirplayYouTube error", e),
  );

  return NextResponse.json({
    ok: true,
    deprecated: true,
    hint: "Use /api/cron/publish-weekly-globals — este endpoint recalcula e sobrescreve o ranking exibido",
    weekIndex: snapshot.weekIndex,
    weekLabel: snapshot.weekLabel,
    dateRange: snapshot.dateRange,
    lastfmAirplayWeek: lastfm.airplay.weekIndex,
    lastfmAlbumsWeek: lastfm.albums.weekIndex,
  });
}
