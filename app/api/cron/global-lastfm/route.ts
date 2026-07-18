import { NextRequest, NextResponse } from "next/server";
import { refreshAllGlobalLastfmSnapshots } from "@/lib/global-lastfm-snapshot";
import { authorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const lastfm = await refreshAllGlobalLastfmSnapshots(new Date());

  return NextResponse.json({
    ok: true,
    airplay: {
      weekIndex: lastfm.airplay.weekIndex,
      weekLabel: lastfm.airplay.weekLabel,
      contributorCount: lastfm.airplay.contributorCount,
      created: lastfm.airplay.created,
    },
    albums: {
      weekIndex: lastfm.albums.weekIndex,
      weekLabel: lastfm.albums.weekLabel,
      contributorCount: lastfm.albums.contributorCount,
      created: lastfm.albums.created,
    },
  });
}
