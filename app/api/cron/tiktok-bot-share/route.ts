import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runTiktokShareRound } from "@/lib/tiktok-bot";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/tiktok-bot-share — a cada 30 min: divulga os próximos perfis
// do TikTok Growth Bot nos grupos ativos (respeita o intervalo configurado).
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runTiktokShareRound();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/tiktok-bot-share]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
