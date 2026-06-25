import { NextRequest, NextResponse } from "next/server";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";
import { authorizedCron } from "@/lib/cron-auth";
import { listGlobalRankingWeekIndexes } from "@/lib/global-snapshot";
import { prisma } from "@/lib/prisma";
import { saveGlobalLastfmSnapshotForWeek } from "@/lib/global-lastfm-snapshot";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

let rebuildRunning = false;

async function rebuildAllAlbumWeeks(fromWeek: number) {
  const allWeeks = await listGlobalRankingWeekIndexes();
  const weeks = allWeeks
    .filter((w) => w >= GLOBAL_RANKING_FIRST_WEEK_INDEX && w >= fromWeek)
    .sort((a, b) => a - b);

  console.log(`[rebuild-album-all] Apagando snapshots >= ${fromWeek}…`);
  await prisma.globalAlbumsSnapshot.deleteMany({ where: { weekIndex: { gte: fromWeek } } });

  for (let i = 0; i < weeks.length; i++) {
    const weekIndex = weeks[i];
    const prefix = `[rebuild-album-all ${i + 1}/${weeks.length}]`;
    try {
      const result = await saveGlobalLastfmSnapshotForWeek("albums", weekIndex);
      console.log(`${prefix} Semana ${weekIndex} → ${result.payload.entries.length} álbum(ns)`);
    } catch (err) {
      console.error(`${prefix} Semana ${weekIndex} ERRO:`, err);
    }
  }

  console.log(`[rebuild-album-all] Concluído — ${weeks.length} semana(s).`);
  rebuildRunning = false;
}

/** Recalcula todos os snapshots Global 100 Álbuns de 2026+ (sequencial, em background). */
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (rebuildRunning) {
    return NextResponse.json({ ok: false, error: "Rebuild já em andamento" }, { status: 409 });
  }

  const fromWeek = Number(req.nextUrl.searchParams.get("from") ?? GLOBAL_RANKING_FIRST_WEEK_INDEX);
  if (!Number.isFinite(fromWeek) || fromWeek < GLOBAL_RANKING_FIRST_WEEK_INDEX) {
    return NextResponse.json(
      { error: `from inválido (mínimo ${GLOBAL_RANKING_FIRST_WEEK_INDEX})` },
      { status: 400 },
    );
  }

  const asyncMode = req.nextUrl.searchParams.get("async") !== "0";
  if (!asyncMode) {
    rebuildRunning = true;
    try {
      await rebuildAllAlbumWeeks(fromWeek);
      return NextResponse.json({ ok: true, fromWeek, mode: "sync" });
    } finally {
      rebuildRunning = false;
    }
  }

  rebuildRunning = true;
  void rebuildAllAlbumWeeks(fromWeek).catch((err) => {
    console.error("[rebuild-album-all] Falha fatal:", err);
    rebuildRunning = false;
  });

  return NextResponse.json(
    { ok: true, fromWeek, mode: "async", status: "started" },
    { status: 202 },
  );
}
