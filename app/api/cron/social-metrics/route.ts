import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { collectSocialMetrics } from "@/lib/social/metrics/collector";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/social-metrics — de hora em hora: coleta métricas de posts do Instagram/Facebook e a foto diária das contas
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const summary = await collectSocialMetrics();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/social-metrics]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
