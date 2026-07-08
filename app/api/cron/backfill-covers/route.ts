import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import {
  enrichSongsWithSpotifyMetadataByIds,
  countSongsMissingCovers,
  findSongsMissingCovers,
} from "@/lib/resolve-publish-songs";
import { probeSpotifyApi, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Correção das músicas pendentes: paradas salvas em modo degradado (Spotify em 429)
// entram sem spotifyId/capa; este cron completa os metadados quando a API volta.
const CRON_BATCH = 100;
const CRON_TIME_BUDGET_MS = 240_000;

// GET /api/cron/backfill-covers — 1x/dia: completa capas/metadados de músicas pendentes
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    if (!spotifyConfigured()) {
      return NextResponse.json({ ok: false, error: "Spotify não configurado" }, { status: 500 });
    }

    // Sob rate limit, não insiste — o próximo cron tenta de novo.
    const probe = await probeSpotifyApi();
    if (!probe.ok) {
      return NextResponse.json({ ok: false, skipped: true, error: probe.error }, { status: 200 });
    }

    const pending = await findSongsMissingCovers(prisma, CRON_BATCH);
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, updated: 0, remaining: 0 });
    }

    const result = await enrichSongsWithSpotifyMetadataByIds(
      prisma,
      pending.map((s) => s.id),
      { searchFallback: true, deadlineAt: Date.now() + CRON_TIME_BUDGET_MS },
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
    });
  } catch (err) {
    console.error("[cron/backfill-covers]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
