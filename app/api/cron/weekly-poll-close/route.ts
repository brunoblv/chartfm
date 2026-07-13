import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { closeWeeklySpotlightPoll } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/weekly-poll-close — terça 6h BRT, sempre no horário fixo (não acompanha o
// horário de publicação configurável da Parada Global): fecha a Votação da Semana (Melhor
// da Semana + Flashback). Idempotente — publishWeeklyGlobalRankings também tenta fechar
// como rede de segurança quando a publicação em si roda depois das 6h.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const rankingWeek = getRankingWeekReference(now, await getGlobalPublishSlot());
    const result = await closeWeeklySpotlightPoll(rankingWeek.weekIndex);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/weekly-poll-close]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
