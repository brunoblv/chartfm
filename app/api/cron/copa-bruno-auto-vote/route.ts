import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { dripBrunoAutoVote } from "@/lib/copa-bruno-auto-vote";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Roda a cada 10 minutos: tira 1 voto da fila (enfileirada pelo botão @bruno)
// e registra de verdade, para os votos não caírem todos juntos.
// Ver lib/copa-bruno-auto-vote.ts.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await dripBrunoAutoVote();
  return NextResponse.json(result);
}
