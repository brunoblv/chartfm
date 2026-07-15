import { NextRequest, NextResponse } from "next/server";
import { authorizeMyTrlCron } from "@/lib/mytrl-access";
import { publishMyTrlWeeklyChart } from "@/lib/mytrl-weekly-chart";
import { probeSpotifyApi } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/mytrl-weekly — sexta 8:15 BRT, após a diária de sexta
export async function GET(req: NextRequest) {
  if (!authorizeMyTrlCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Sob rate limit, não insiste — a próxima sexta tenta de novo.
    const probe = await probeSpotifyApi();
    if (!probe.ok) {
      return NextResponse.json({ ok: false, skipped: true, error: probe.error });
    }

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
