import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runReleaseRadar } from "@/lib/release-radar";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/release-radar — de hora em hora: checa artistas monitorados e avisa lançamentos no Telegram
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runReleaseRadar();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[cron/release-radar]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
