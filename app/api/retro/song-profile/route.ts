import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";

const PEAK_VALUES = new Set(["1", "top3", "top5", "top10", "top20", "top40", "top100", "out"]);
const NOTE_MAX = 1000;

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * POST /api/retro/song-profile
 * Grava o ajuste humano de uma música (importance, peak potential, ajuste, nota).
 * Definir importance/peak trava o valor (`*Locked`) — o motor não recalcula mais.
 * Enviar null "destrava" e volta ao valor calculado. Restrito ao @bruno.
 */
export async function POST(req: NextRequest) {
  const userId = await requireBruno();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.songId !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const songId: string = body.songId;

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) return NextResponse.json({ error: "song_not_found" }, { status: 404 });

  // Monta o patch só com os campos presentes no corpo (edição parcial).
  const data: Record<string, unknown> = {};

  if ("importance" in body) {
    if (body.importance === null) {
      data.importance = null;
      data.importanceLocked = false;
    } else {
      const imp = clampInt(body.importance, 0, 100);
      if (imp === null) return NextResponse.json({ error: "invalid_importance" }, { status: 400 });
      data.importance = imp;
      data.importanceLocked = true;
    }
  }

  if ("peakPotential" in body) {
    if (body.peakPotential === null) {
      data.peakPotential = null;
      data.peakPotentialLocked = false;
    } else if (typeof body.peakPotential === "string" && PEAK_VALUES.has(body.peakPotential)) {
      data.peakPotential = body.peakPotential;
      data.peakPotentialLocked = true;
    } else {
      return NextResponse.json({ error: "invalid_peak_potential" }, { status: 400 });
    }
  }

  if ("manualAdjustment" in body) {
    const adj = clampInt(body.manualAdjustment, -50, 50);
    if (adj === null) return NextResponse.json({ error: "invalid_adjustment" }, { status: 400 });
    data.manualAdjustment = adj;
  }

  if ("note" in body) {
    if (body.note === null || body.note === "") {
      data.note = null;
    } else if (typeof body.note === "string") {
      data.note = body.note.slice(0, NOTE_MAX);
    } else {
      return NextResponse.json({ error: "invalid_note" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const profile = await prisma.retroSongProfile.upsert({
    where: { userId_songId: { userId, songId } },
    create: { userId, songId, ...data },
    update: data,
  });

  return NextResponse.json({ profile });
}
