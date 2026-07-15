import { NextRequest, NextResponse } from "next/server";
import { authorizeMyTrlCron } from "@/lib/mytrl-access";
import { runDailyMyTrlJob } from "@/lib/mytrl-daily-parada";
import { probeSpotifyApi } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/mytrl — seg–sex 8h10 BRT: top 10 → UMS Request Live
export async function GET(req: NextRequest) {
  if (!authorizeMyTrlCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Sob rate limit, não insiste — o próximo dia útil tenta de novo.
    const probe = await probeSpotifyApi();
    if (!probe.ok) {
      return NextResponse.json({ ok: false, skipped: true, error: probe.error });
    }

    const result = await runDailyMyTrlJob(new Date(), { skipSnapshotRecompute: true });
    if (!result.ok && result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.error, stage: result.stage });
    }
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      cron: true,
      weekday: result.snapshot.weekday,
      weekIndex: result.snapshot.weekIndex,
      snapshotCount: result.snapshot.count,
      chartId: result.publish.chartId,
      weekLabel: result.publish.weekLabel,
      published: result.publish.count,
      created: result.publish.created,
    });
  } catch (err) {
    console.error("[cron/mytrl]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
