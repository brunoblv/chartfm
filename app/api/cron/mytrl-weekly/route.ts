import { NextRequest, NextResponse } from "next/server";
import { authorizeMyTrlCron } from "@/lib/mytrl-access";
import { publishMyTrlWeeklyChart } from "@/lib/mytrl-weekly-chart";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/mytrl-weekly — sexta 7h BRT (10:00 UTC)
export async function GET(req: NextRequest) {
  if (!authorizeMyTrlCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await publishMyTrlWeeklyChart(new Date());
    if (!result.ok && result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.error });
    }
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ...result, cron: true });
  } catch (err) {
    console.error("[cron/mytrl-weekly]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
