import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { publishWeeklyGlobalRankings } from "@/lib/publish-weekly-globals";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/publish-weekly-globals — terça 5h BRT: Global 100 + Airplay + Álbuns (congelado) + playlists
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await publishWeeklyGlobalRankings(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/publish-weekly-globals]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
