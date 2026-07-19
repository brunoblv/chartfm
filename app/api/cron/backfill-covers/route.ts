import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import {
  enrichSongsWithSpotifyMetadataByIds,
  countSongsMissingCovers,
  findSongsMissingCovers,
} from "@/lib/resolve-publish-songs";
import {
  backup3SpotifyConfigured,
  markPrimaryLimited,
  probeSpotifyApi,
  probeSpotifyBackupApi,
  probeSpotifyBackup3Api,
  spotifyConfigured,
} from "@/lib/spotify-server";
import { runWithSpotifyBackfillPool } from "@/lib/spotify-user-charts-pool";

export const runtime = "nodejs";
export const maxDuration = 300;

// Correção das músicas pendentes: paradas salvas em modo degradado (Spotify em 429)
// entram sem spotifyId/capa; este cron completa os metadados quando a API volta.
const CRON_BATCH = 100;
const CRON_TIME_BUDGET_MS = 240_000;

// GET /api/cron/backfill-covers — 1x/dia às 12h: completa capas/metadados de músicas pendentes.
// Músicas sem match no Spotify ganham sourcesNotFound=["spotify"] e saem da fila (ver findSongsMissingCovers).
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    if (!spotifyConfigured()) {
      return NextResponse.json({ ok: false, error: "Spotify não configurado" }, { status: 500 });
    }

    // Preferência: BACKUP3 (pool backfill). Sem BACKUP3, cai no principal → backup.
    if (backup3SpotifyConfigured()) {
      const probe3 = await probeSpotifyBackup3Api();
      if (!probe3.ok) {
        return NextResponse.json(
          { ok: false, skipped: true, error: probe3.error, app: "backup3" },
          { status: 200 },
        );
      }
    } else {
      const probe = await probeSpotifyApi();
      if (!probe.ok) {
        const backupProbe = await probeSpotifyBackupApi();
        if (!backupProbe.ok) {
          return NextResponse.json(
            { ok: false, skipped: true, error: probe.error, backupError: backupProbe.error },
            { status: 200 },
          );
        }
        markPrimaryLimited(probe.retryAfterMs ?? undefined);
        console.warn(`[cron/backfill-covers] app principal com erro (${probe.error}) — rodando no backup`);
      }
    }

    const pending = await findSongsMissingCovers(prisma, CRON_BATCH);
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, updated: 0, remaining: 0 });
    }

    const result = await runWithSpotifyBackfillPool(() =>
      enrichSongsWithSpotifyMetadataByIds(
        prisma,
        pending.map((s) => s.id),
        { searchFallback: true, deadlineAt: Date.now() + CRON_TIME_BUDGET_MS, markNotFoundOnFail: true },
      ),
    );
    const remaining = await countSongsMissingCovers(prisma);

    return NextResponse.json({
      ok: true,
      processed: pending.length - result.deferredIds.length,
      updated: result.updated,
      viaBatch: result.viaBatch,
      viaSearch: result.viaSearch,
      deferred: result.deferredIds.length,
      remaining,
      app: backup3SpotifyConfigured() ? "backup3" : "default",
    });
  } catch (err) {
    console.error("[cron/backfill-covers]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
