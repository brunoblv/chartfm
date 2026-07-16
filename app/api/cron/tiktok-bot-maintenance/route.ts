import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runTiktokBotMaintenance } from "@/lib/tiktok-bot";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/tiktok-bot-maintenance — de hora em hora: pesquisa de retorno
// pós-divulgação (DM) e confirmação periódica de participação (15 dias).
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runTiktokBotMaintenance();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/tiktok-bot-maintenance]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
