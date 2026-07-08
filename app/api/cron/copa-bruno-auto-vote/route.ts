import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runBrunoAutoVote } from "@/lib/copa-bruno-auto-vote";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Roda a cada minuto: faz os 22 usuários das paradas "de estilo" votarem nos
// jogos "LIVE" da Copa ativa assim que abrem (Silverchair, Bring Me the
// Horizon, Foo Fighters e Keane sempre no lado deles). Idempotente — não
// duplica nem altera votos já dados. Ver lib/copa-bruno-auto-vote.ts.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await runBrunoAutoVote();
  return NextResponse.json(result);
}
