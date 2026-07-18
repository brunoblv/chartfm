import { NextRequest, NextResponse } from "next/server";
import { syncActiveClubeRounds } from "@/lib/clube-album";
import { authorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Roda de hora em hora e reconcilia rodadas ativas do Clube do Álbum com o
// calendário: abre inscrições, avança enquete/resultado/escuta e dispara
// notificações + posts no feed da ChartFM.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results = await syncActiveClubeRounds();

  return NextResponse.json({ ok: true, rounds: results.length, results });
}
