import { NextRequest, NextResponse } from "next/server";
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
