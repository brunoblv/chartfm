import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { refreshDailyAppStats } from "@/lib/daily-app-stats";

export const runtime = "nodejs";
export const maxDuration = 300;

/** @deprecated Use /api/cron/daily-app-stats (0h) e /api/cron/daily-user-stats (8h). */
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await refreshDailyAppStats(new Date());
  return NextResponse.json({
    ok: true,
    deprecated: true,
    hint: "Use /api/cron/daily-app-stats e /api/cron/daily-user-stats",
    ...result,
  });
}
