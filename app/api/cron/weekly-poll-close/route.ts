import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { getWeeklyPollTargetWeek, closeAllWeeklySpotlightPolls } from "@/lib/weekly-spotlight-poll";
import { getWeeklyPollCloseSlot, hasWeeklyPollActionPassed } from "@/lib/weekly-poll-schedule";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/weekly-poll-close — reconcilia de hora em hora: fecha a Votação da Semana
// (global + comunidades) no horário configurado em /admin/parada-global. Idempotente —
// publishWeeklyGlobalRankings também tenta fechar como rede de segurança.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const closeSlot = await getWeeklyPollCloseSlot();
    if (!hasWeeklyPollActionPassed(now, closeSlot)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "horário de fechamento da enquete ainda não chegou",
        closeSlot,
      });
    }

    // Mesma semana-alvo da abertura (domingo mais recente), não o ranking da Parada Global.
    const week = getWeeklyPollTargetWeek(now);
    const result = await closeAllWeeklySpotlightPolls(week.weekIndex);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/weekly-poll-close]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
