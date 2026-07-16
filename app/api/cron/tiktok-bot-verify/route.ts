import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runTiktokAccountCheck } from "@/lib/tiktok-bot";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/tiktok-bot-verify — domingos, de hora em hora, em lotes:
// verifica se os perfis ainda existem no TikTok (404 → pausa e avisa por DM).
// Cada perfil é checado no máximo 1x/semana; lote pequeno + 3s entre perfis
// para não tomar bloqueio (mesma filosofia do release-radar).
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runTiktokAccountCheck();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/tiktok-bot-verify]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
