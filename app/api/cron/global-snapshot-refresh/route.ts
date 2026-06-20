import { NextRequest, NextResponse } from "next/server";
import { refreshRankingWeekSnapshot } from "@/lib/global-snapshot";
import { refreshAllGlobalLastfmSnapshots } from "@/lib/global-lastfm-snapshot";

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

  return NextResponse.json({
    ok: true,
    weekIndex: snapshot.weekIndex,
    weekLabel: snapshot.weekLabel,
    dateRange: snapshot.dateRange,
    lastfmAirplayWeek: lastfm.airplay.weekIndex,
    lastfmAlbumsWeek: lastfm.albums.weekIndex,
  });
}
