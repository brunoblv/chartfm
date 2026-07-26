import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import {
  openAllCommunitySpotlightPolls,
  openWeeklySpotlightPoll,
} from "@/lib/weekly-spotlight-poll";
import { getWeeklyPollOpenSlot, hasWeeklyPollActionPassed } from "@/lib/weekly-poll-schedule";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/weekly-poll-open — reconcilia de hora em hora: só abre a enquete global e as
// de comunidade quando o horário configurado em /admin/parada-global já passou nesta semana.
export async function GET(req: Request) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const openSlot = await getWeeklyPollOpenSlot();
    if (!hasWeeklyPollActionPassed(now, openSlot)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "horário de abertura da enquete ainda não chegou",
        openSlot,
      });
    }

    const global = await openWeeklySpotlightPoll(now);
    const communities = await openAllCommunitySpotlightPolls(now);
    return NextResponse.json({ ok: true, global, communities });
  } catch (err) {
    console.error("[cron/weekly-poll-open]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
