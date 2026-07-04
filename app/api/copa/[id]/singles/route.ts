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
  getLockedSlotIndexes,
  applyCopaSingleMoveFromEditable,
  isSingleSlotEditableInWindow,
  mergeArtistSingles,
  songPickKey,
  validateArtistSingleAssignment,
} from "@/lib/copa";
import { getR32WinnerArtistIds } from "@/lib/copa-knockout";
import { resolveSongsForFastPublish } from "@/lib/resolve-publish-songs";

// PUT /api/copa/[id]/singles
// body: { artistId, singles: [{slotIndex, songName, songId?, spotifySongId?}] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { artistId, singles } = body as {
    artistId: string;
    singles: { slotIndex: number; songName: string; songId?: string | null; spotifySongId?: string | null }[];
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
    const isEmptyPlaceholder = /^Single \d+$/i.test(s.songName.trim());
    if (!isEmptyPlaceholder && !s.songId && !s.spotifySongId) {
      return NextResponse.json(
        { error: "Selecione uma música da busca (catálogo ou Spotify) — não é permitido texto livre" },
        { status: 400 },
      );
    }
  }

  // Resolve (ou crie) a Song local para escolhas vindas de um resultado do Spotify
  // que ainda não existe no catálogo local.
  const needsResolution = singles
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.songId && s.spotifySongId);
  if (needsResolution.length > 0) {
    const resolved = await resolveSongsForFastPublish(
      prisma,
      needsResolution.map(({ s }) => ({
        title: s.songName.trim(),
        artist: artist.artistName,
        spotifyId: s.spotifySongId,
      })),
    );
    needsResolution.forEach(({ i }, idx) => {
      singles[i] = { ...singles[i], songId: resolved[idx].id };
    });
  }

  const songIds = [...new Set(singles.map((s) => s.songId).filter((v): v is string => Boolean(v)))];
  if (songIds.length > 0) {
    const foundSongs = await prisma.song.findMany({ where: { id: { in: songIds } }, select: { id: true } });
    const foundIds = new Set(foundSongs.map((f) => f.id));
    if (foundIds.size !== songIds.length) {
      return NextResponse.json({ error: "Música inválida" }, { status: 400 });
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
  const lockedIndexes = getLockedSlotIndexes(locked);
  const validationOpts = locked.length > 0 ? { lockedSlotIndexes: lockedIndexes } : undefined;
  const editWindowBase = getCopaSinglesEditWindow(copa.status, allFixtures);
  const r32Winners =
    editWindowBase.nextPhase === "R16" && editWindowBase.open
      ? await getR32WinnerArtistIds(id)
      : null;
  const editWindow =
    r32Winners && r32Winners.length > 0
      ? { ...editWindowBase, competingArtistIds: r32Winners }
      : editWindowBase;

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

  // Move automático entre slots editáveis (mesma música saindo de etapa futura).
  let normalized = merged;
  for (const s of updates) {
    const prev = existing.find((e) => e.slotIndex === s.slotIndex);
    const changed =
      !prev || prev.songName !== s.songName || (prev.songId ?? null) !== s.songId;
    if (!changed) continue;
    if (!isSingleSlotEditableInWindow(s.slotIndex, editWindow, locked, artistId)) continue;
    normalized = applyCopaSingleMoveFromEditable(normalized, s.slotIndex, s.songName, s.songId, lockedIndexes);
  }

  // Reordenação pura (swap/arrastar) não muda o conjunto de músicas — nunca é
  // bloqueada por reuso. A validação de duplicata vale só quando a requisição
  // adiciona ou troca uma música da lista.
  const songKeyMultiset = (picks: { slotIndex: number; songName: string; songId: string | null }[]) =>
    picks
      .map((s) => songPickKey(s.songId, s.songName))
      .filter((k): k is string => k != null)
      .sort()
      .join("\n");
  const isReorderOnly = songKeyMultiset(normalized) === songKeyMultiset(existingPicks);

  for (const s of updates) {
    const prev = existing.find((e) => e.slotIndex === s.slotIndex);
    const changed =
      !prev || prev.songName !== s.songName || (prev.songId ?? null) !== s.songId;
    if (!changed) continue;

    if (!isSingleSlotEditableInWindow(s.slotIndex, editWindow, locked, artistId)) {
      const label = SLOT_LABELS[s.slotIndex] ?? `Slot ${s.slotIndex + 1}`;
      return NextResponse.json(
        { error: editWindow.open ? `"${label}" não pode ser alterada agora.` : editWindow.message },
        { status: 400 },
      );
    }

    if (isReorderOnly) continue;

    const dupErr = validateArtistSingleAssignment(s.slotIndex, s.songName, s.songId, normalized, validationOpts);
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 400 });
    }
  }

  if (!isReorderOnly) {
    const fullDupErr = findDuplicateSongInSingles(normalized, validationOpts);
    if (fullDupErr) {
      return NextResponse.json({ error: fullDupErr }, { status: 400 });
    }
  }

  await Promise.all(
    normalized.map((s) => {
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
