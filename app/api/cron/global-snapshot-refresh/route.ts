import { NextRequest, NextResponse } from "next/server";
import { refreshRankingWeekSnapshot } from "@/lib/global-snapshot";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Recomputa (upsert) o snapshot da semana de ranking corrente a cada execução,
  // para refletir paradas publicadas após a primeira geração até o deadline.
  // Reexecutar após o deadline é idempotente (o filtro de corte é fixo).
  const snapshot = await refreshRankingWeekSnapshot(new Date());

  return NextResponse.json({
    ok: true,
    weekIndex: snapshot.weekIndex,
    weekLabel: snapshot.weekLabel,
    dateRange: snapshot.dateRange,
  });
}
