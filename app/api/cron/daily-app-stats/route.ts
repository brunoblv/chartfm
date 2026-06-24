import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { refreshDailyAppStats } from "@/lib/daily-app-stats";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/daily-app-stats — 0h BRT: pontos + agregado global + snapshots de entidade (stats do app)
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await refreshDailyAppStats(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/daily-app-stats]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
