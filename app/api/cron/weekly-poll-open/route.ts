import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { openWeeklySpotlightPoll } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/weekly-poll-open — domingo 23:59 BRT: abre a enquete da semana
// (Melhor da Semana + Flashback) e notifica todos os usuários.
export async function GET(req: Request) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await openWeeklySpotlightPoll(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/weekly-poll-open]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
