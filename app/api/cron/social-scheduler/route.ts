import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runSchedulerTick } from "@/lib/social/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/social-scheduler — a cada 15-30min: agenda a fila editorial e publica os posts do slot atual
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runSchedulerTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/social-scheduler]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
