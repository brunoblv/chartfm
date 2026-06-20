import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import {
  saveGlobalLastfmSnapshotForWeek,
  listGlobalLastfmWeekIndexes,
  loadGlobalLastfmSnapshot,
} from "@/lib/global-lastfm-snapshot";
import type { GlobalLastfmMode } from "@/lib/global-lastfm-ranking";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isValidMode(v: unknown): v is GlobalLastfmMode {
  return v === "airplay" || v === "albums";
}

/** GET — lista snapshots existentes para o modo */
export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const mode = (req.nextUrl.searchParams.get("mode") ?? "airplay") as GlobalLastfmMode;
  if (!isValidMode(mode)) {
    return NextResponse.json({ error: "mode deve ser airplay ou albums" }, { status: 400 });
  }

  const weekIndexes = await listGlobalLastfmWeekIndexes(mode);
  return NextResponse.json({ mode, weekIndexes });
}

/** POST — gera (ou recalcula) snapshot para uma semana específica */
export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await req.json()) as { mode?: unknown; weekIndex?: unknown };

  if (!isValidMode(body.mode)) {
    return NextResponse.json({ error: "mode deve ser airplay ou albums" }, { status: 400 });
  }
  const weekIndex = Number(body.weekIndex);
  if (!Number.isFinite(weekIndex) || weekIndex < 202601) {
    return NextResponse.json({ error: "weekIndex inválido (mínimo 202601)" }, { status: 400 });
  }

  const result = await saveGlobalLastfmSnapshotForWeek(body.mode, weekIndex);

  return NextResponse.json({
    ok: true,
    mode: body.mode,
    weekIndex: result.weekIndex,
    contributorCount: result.payload.contributorCount,
    entriesCount: result.payload.entries.length,
    scoringWindow: result.payload.scoringWindow,
  });
}
