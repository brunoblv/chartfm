import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { runNightlyCatalogBackfill } from "@/lib/catalog-nightly-backfill";

export const runtime = "nodejs";
export const maxDuration = 1500;

// GET /api/cron/nightly-catalog-backfill — 1h BRT: completa músicas, álbuns e
// artistas com Wikipedia/MusicBrainz/Last.fm/Spotify. Itens sem resultado em
// nenhuma fonte são marcados (ver lib/catalog-nightly-backfill.ts) e não
// reentram na fila em dias seguintes.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const report = await runNightlyCatalogBackfill();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[cron/nightly-catalog-backfill]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
