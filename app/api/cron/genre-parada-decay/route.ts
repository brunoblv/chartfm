import { NextRequest, NextResponse } from "next/server";
import { advanceAutoDecayParadas } from "@/lib/genre-parada-decay";
import { authorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Paradas "de estilo" (Parada.autoDecay=true): quando o slot semanal de cada
// parada vence (dia/hora BRT estáveis e distintos por id), a metade de cima
// cai 1-7 posições e a de baixo sobe 1-7; slots vagos no topo vêm do Last.fm.
// Ver lib/genre-parada-decay.ts e lib/genre-parada-schedule.ts.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results = await advanceAutoDecayParadas();

  return NextResponse.json({ ok: true, results });
}
