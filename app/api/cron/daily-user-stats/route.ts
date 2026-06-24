import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { refreshDailyUserStats } from "@/lib/daily-user-stats";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/daily-user-stats — 8h BRT: snapshots de entidade (stats por usuário/parada)
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await refreshDailyUserStats(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/daily-user-stats]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
