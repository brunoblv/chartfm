import { NextRequest, NextResponse } from "next/server";
import { authorizeMyTrlCron } from "@/lib/mytrl-access";
import { runDailyMyTrlJob } from "@/lib/mytrl-daily-parada";
import { probeSpotifyApi } from "@/lib/spotify-server";
import { runWithSpotifyBackfillPool } from "@/lib/spotify-user-charts-pool";
import { tryConsumeSpotifyBudget } from "@/lib/spotify-budget";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/mytrl — seg–sex 8h10 BRT: top 10 → UMS Request Live
// Roda no pool "backfill" (app BACKUP3) — job de fundo, isolado do app
// principal/backup usado por buscas/ações de usuário reais.
export async function GET(req: NextRequest) {
  if (!authorizeMyTrlCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!tryConsumeSpotifyBudget("mytrl", 20)) {
    return NextResponse.json({ ok: true, skipped: true, error: "Orçamento diário do Spotify (categoria mytrl) esgotado" });
  }

  try {
    // Sob rate limit, não insiste — o próximo dia útil tenta de novo.
    const probe = await runWithSpotifyBackfillPool(() => probeSpotifyApi());
    if (!probe.ok) {
      return NextResponse.json({ ok: false, skipped: true, error: probe.error });
    }

    const result = await runWithSpotifyBackfillPool(() =>
      runDailyMyTrlJob(new Date(), { skipSnapshotRecompute: true }),
    );
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
