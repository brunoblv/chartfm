import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  COPA_SINGLES_COUNT,
  SLOT_LABELS,
  findDuplicateSongInSingles,
  getCopaSinglesEditWindow,
  getLockedSingleSlots,
  isSingleSlotEditableInWindow,
  mergeArtistSingles,
  validateArtistSingleAssignment,
} from "@/lib/copa";

// PUT /api/copa/[id]/singles
// body: { artistId, singles: [{slotIndex, songName, songId?}] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { artistId, singles } = body as {
    artistId: string;
    singles: { slotIndex: number; songName: string; songId?: string | null }[];
  };

  if (!artistId || !Array.isArray(singles)) {
    return NextResponse.json({ error: "artistId e singles são obrigatórios" }, { status: 400 });
  }

  const [artist, copa] = await Promise.all([
    prisma.copaArtist.findUnique({ where: { id: artistId } }),
    prisma.copaEdition.findUnique({ where: { id } }),
  ]);
  if (!artist || !copa || artist.copaId !== id || artist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  for (const s of singles) {
    if (s.slotIndex < 0 || s.slotIndex >= COPA_SINGLES_COUNT) {
      return NextResponse.json({ error: "slotIndex inválido" }, { status: 400 });
    }
    if (!s.songName?.trim()) {
      return NextResponse.json({ error: "songName é obrigatório" }, { status: 400 });
    }
  }

  const [artistFixtures, allFixtures, existing] = await Promise.all([
    prisma.copaFixture.findMany({
      where: {
        copaId: id,
        OR: [{ artistAId: artistId }, { artistBId: artistId }],
        status: { in: ["LIVE", "DONE"] },
      },
      select: {
        artistAId: true,
        artistBId: true,
        singleAIdx: true,
        singleBIdx: true,
        status: true,
        phase: true,
      },
    }),
    prisma.copaFixture.findMany({
      where: { copaId: id },
      select: { phase: true, status: true, matchIndex: true },
    }),
    prisma.copaSingle.findMany({ where: { copaArtistId: artistId } }),
  ]);

  const locked = getLockedSingleSlots(artistId, artistFixtures);
  const editWindow = getCopaSinglesEditWindow(copa.status, allFixtures);

  const existingPicks = existing.map((e) => ({
    slotIndex: e.slotIndex,
    songName: e.songName,
    songId: e.songId,
  }));

  const updates = singles.map((s) => ({
    slotIndex: s.slotIndex,
    songName: s.songName.trim(),
    songId: s.songId ?? null,
  }));

  const merged = mergeArtistSingles(existingPicks, updates);

  for (const s of updates) {
    const prev = existing.find((e) => e.slotIndex === s.slotIndex);
    const changed =
      !prev || prev.songName !== s.songName || (prev.songId ?? null) !== s.songId;
    if (!changed) continue;

    if (!isSingleSlotEditableInWindow(s.slotIndex, editWindow, locked)) {
      const label = SLOT_LABELS[s.slotIndex] ?? `Slot ${s.slotIndex + 1}`;
      return NextResponse.json(
        { error: editWindow.open ? `"${label}" não pode ser alterada agora.` : editWindow.message },
        { status: 400 },
      );
    }

    const dupErr = validateArtistSingleAssignment(s.slotIndex, s.songName, s.songId, merged);
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 400 });
    }
  }

  const fullDupErr = findDuplicateSongInSingles(merged);
  if (fullDupErr) {
    return NextResponse.json({ error: fullDupErr }, { status: 400 });
  }

  await Promise.all(
    updates.map((s) => {
      const prev = existing.find((e) => e.slotIndex === s.slotIndex);
      const changed =
        !prev || prev.songName !== s.songName || (prev.songId ?? null) !== s.songId;
      if (!changed) return Promise.resolve();
      return prisma.copaSingle.upsert({
        where: { copaArtistId_slotIndex: { copaArtistId: artistId, slotIndex: s.slotIndex } },
        create: {
          copaArtistId: artistId,
          slotIndex: s.slotIndex,
          songName: s.songName,
          songId: s.songId,
        },
        update: {
          songName: s.songName,
          songId: s.songId,
        },
      });
    }),
  );

  const updated = await prisma.copaSingle.findMany({
    where: { copaArtistId: artistId },
    orderBy: { slotIndex: "asc" },
  });

  return NextResponse.json({ singles: updated });
}
