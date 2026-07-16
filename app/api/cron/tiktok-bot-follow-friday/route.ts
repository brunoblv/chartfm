import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runFollowFriday } from "@/lib/tiktok-bot";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/tiktok-bot-follow-friday — sexta 19h: mensagem especial com
// um lote grande de perfis (idempotente: no máximo 1 por dia).
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runFollowFriday();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/tiktok-bot-follow-friday]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
