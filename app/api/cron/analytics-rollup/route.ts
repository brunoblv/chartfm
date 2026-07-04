import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runAnalyticsRollup } from "@/lib/analytics-rollup";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/analytics-rollup — 0h20 BRT: consolida o dia anterior e purga eventos >90d
// ?days=N reprocessa os últimos N dias fechados (backfill)
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const daysRaw = parseInt(req.nextUrl.searchParams.get("days") ?? "1", 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 1;
    const result = await runAnalyticsRollup(new Date(), days);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/analytics-rollup]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
