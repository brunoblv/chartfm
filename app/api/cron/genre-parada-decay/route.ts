import { NextRequest, NextResponse } from "next/server";
import { advanceAutoDecayParadas } from "@/lib/genre-parada-decay";
import { authorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Paradas "de estilo" (Parada.autoDecay=true): a cada ~7 dias após a última
// edição, a metade de cima da parada cai 1-7 posições aleatórias (saindo se
// ultrapassar o tamanho da parada) e a metade de baixo sobe 1-7 posições; o(s)
// slot(s) vago(s) no topo são preenchidos com novas faixas do Last.fm dos
// usuários-fonte, filtradas pelo gênero da parada. Ver lib/genre-parada-decay.ts.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results = await advanceAutoDecayParadas();

  return NextResponse.json({ ok: true, results });
}
