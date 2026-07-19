import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import {
  openAllCommunitySpotlightPolls,
  openWeeklySpotlightPoll,
} from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/weekly-poll-open — domingo 23:59 BRT: abre a enquete global e as
// enquetes de cada comunidade (só membros) e notifica quem deve votar.
export async function GET(req: Request) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const global = await openWeeklySpotlightPoll(now);
    const communities = await openAllCommunitySpotlightPolls(now);
    return NextResponse.json({ ok: true, global, communities });
  } catch (err) {
    console.error("[cron/weekly-poll-open]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
