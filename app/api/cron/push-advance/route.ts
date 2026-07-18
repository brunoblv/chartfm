import { NextRequest, NextResponse } from "next/server";
import { syncPushRoundToSchedule } from "@/lib/push-advance";
import { authorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Roda de hora em hora e reconcilia a rodada atual do Push com seus prazos:
// encerra as inscrições em submissionEndsAt (gera playlists, revela as músicas
// e anuncia) e publica o resultado em rankingEndsAt. O botão Avançar Fase do
// admin continua funcionando para adiantar a virada manualmente.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await syncPushRoundToSchedule();

  return NextResponse.json({ ok: true, result });
}
