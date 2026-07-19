import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";
import { PEAK_POTENTIAL_SET, RELEASE_REF_SOURCE_SET } from "@/lib/retro/scoring";

const NOTE_MAX = 1000;

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const BULK_MAX = 1000;

/**
 * POST /api/retro/song-profile
 * Grava o ajuste humano de uma música (importance, peak potential, ajuste, nota).
 * Definir importance/peak trava o valor (`*Locked`) — o motor não recalcula mais.
 * Enviar null "destrava" e volta ao valor calculado. Restrito ao @bruno.
 *
 * Aceita `songId` (uma música) OU `songIds: string[]` (lote — ex.: marcar
 * várias como "Fora" de uma vez); o mesmo patch é aplicado a todas.
 */
export async function POST(req: NextRequest) {
  const userId = await requireBruno();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const isBulk = Array.isArray(body?.songIds);
  if (!body || (!isBulk && typeof body.songId !== "string")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const requestedIds: string[] = isBulk
    ? body.songIds.filter((id: unknown): id is string => typeof id === "string").slice(0, BULK_MAX)
    : [body.songId];
  if (requestedIds.length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const found = await prisma.song.findMany({ where: { id: { in: requestedIds } }, select: { id: true } });
  if (found.length === 0) return NextResponse.json({ error: "song_not_found" }, { status: 404 });
  const songIds = found.map((s) => s.id);

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
    } else if (typeof body.peakPotential === "string" && PEAK_POTENTIAL_SET.has(body.peakPotential)) {
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

  if ("billboardHot100DebutDate" in body) {
    if (body.billboardHot100DebutDate === null) {
      data.billboardHot100DebutDate = null;
    } else if (typeof body.billboardHot100DebutDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.billboardHot100DebutDate)) {
      const d = new Date(`${body.billboardHot100DebutDate}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "invalid_billboard_date" }, { status: 400 });
      data.billboardHot100DebutDate = d;
    } else {
      return NextResponse.json({ error: "invalid_billboard_date" }, { status: 400 });
    }
  }

  if ("debutSourcePreferred" in body) {
    if (body.debutSourcePreferred === null) {
      data.debutSourcePreferred = null;
    } else if (typeof body.debutSourcePreferred === "string" && RELEASE_REF_SOURCE_SET.has(body.debutSourcePreferred)) {
      data.debutSourcePreferred = body.debutSourcePreferred;
    } else {
      return NextResponse.json({ error: "invalid_debut_source_preferred" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const profiles = await prisma.$transaction(
    songIds.map((songId) =>
      prisma.retroSongProfile.upsert({
        where: { userId_songId: { userId, songId } },
        create: { userId, songId, ...data },
        update: data,
      }),
    ),
  );

  return NextResponse.json(isBulk ? { updated: profiles.length } : { profile: profiles[0] });
}
