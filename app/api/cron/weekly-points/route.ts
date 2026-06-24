import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { syncChartEntryPointsForRankingWeek } from "@/lib/sync-chart-entry-points";

export const runtime = "nodejs";
export const maxDuration = 300;

/** @deprecated Use /api/cron/daily-app-stats (0h) e /api/cron/publish-weekly-globals (terça 5h). */
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await syncChartEntryPointsForRankingWeek(new Date());
  return NextResponse.json({
    ok: true,
    deprecated: true,
    hint: "Use /api/cron/daily-app-stats e /api/cron/publish-weekly-globals",
    ...result,
  });
}
