import { NextRequest, NextResponse } from "next/server";
import { syncActiveClubeRounds } from "@/lib/clube-album";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Roda de hora em hora e reconcilia rodadas ativas do Clube do Álbum com o
// calendário: abre inscrições, avança enquete/resultado/escuta e dispara
// notificações + posts no feed da ChartFM.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results = await syncActiveClubeRounds();

  return NextResponse.json({ ok: true, rounds: results.length, results });
}
