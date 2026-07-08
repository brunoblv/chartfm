import { NextRequest, NextResponse } from "next/server";
import { syncPushRoundToSchedule } from "@/lib/push-advance";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Roda de hora em hora e reconcilia a rodada atual do Push com seus prazos:
// encerra as inscrições em submissionEndsAt (gera playlists, revela as músicas
// e anuncia) e publica o resultado em rankingEndsAt. O botão Avançar Fase do
// admin continua funcionando para adiantar a virada manualmente.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await syncPushRoundToSchedule();

  return NextResponse.json({ ok: true, result });
}
