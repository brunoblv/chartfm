import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getArtistColor, getArtistInitials, COPA_UNASSIGNED_GROUP } from "@/lib/copa";
import { getSpotifyArtistById } from "@/lib/spotify-server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { artistSpotifyId, artistName, artistImage } = body as {
    artistSpotifyId: string | null;
    artistName: string;
    artistImage?: string | null;
  };

  if (!artistName?.trim()) {
    return NextResponse.json({ error: "Artist name required" }, { status: 400 });
  }
  if (!artistSpotifyId) {
    return NextResponse.json(
      { error: "Selecione um artista da busca (catálogo ou Spotify) — não é permitido texto livre" },
      { status: 400 },
    );
  }

  const [localArtist, spotifyProfile] = await Promise.all([
    prisma.artist.findUnique({ where: { spotifyId: artistSpotifyId } }),
    getSpotifyArtistById(artistSpotifyId),
  ]);
  if (!localArtist && !spotifyProfile) {
    return NextResponse.json({ error: "Artista inválido" }, { status: 400 });
  }

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa || copa.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Registration not open" }, { status: 400 });
  }

  const participant = await prisma.copaParticipant.findUnique({
    where: { copaId_userId: { copaId: id, userId: session.user.id } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Check artist not already claimed
  if (artistSpotifyId) {
    const existing = await prisma.copaArtist.findFirst({
      where: { copaId: id, artistSpotifyId },
    });
    if (existing) {
      return NextResponse.json({ error: "Artist already claimed" }, { status: 409 });
    }
  }

  // Count user's existing artists
  const myArtists = await prisma.copaArtist.findMany({
    where: { copaId: id, ownerId: session.user.id },
  });
  if (myArtists.length >= copa.artistsPerUser) {
    return NextResponse.json({ error: "Artist limit reached" }, { status: 400 });
  }

  // Artists are NOT placed into a group on claim — groups are formed later by the
  // draw (sorteio), once every participant has registered their full roster.
  // We park the artist in the placeholder group with a unique running slot index
  // to satisfy the (copaId, groupLetter, slotInGroup) uniqueness constraint.
  const color = getArtistColor(artistSpotifyId);
  const initials = getArtistInitials(artistName);

  let resolvedImage = artistImage?.trim() || null;
  if (!resolvedImage) {
    resolvedImage = localArtist?.imageUrl ?? spotifyProfile?.imageUrl ?? null;
  }

  let artist = null;
  for (let attempt = 0; attempt < 10 && !artist; attempt++) {
    const count = await prisma.copaArtist.count({ where: { copaId: id } });
    try {
      artist = await prisma.copaArtist.create({
        data: {
          copaId: id,
          ownerId: session.user.id,
          groupLetter: COPA_UNASSIGNED_GROUP,
          slotInGroup: count + attempt,
          artistSpotifyId: artistSpotifyId ?? null,
          artistName: artistName.trim(),
          artistImage: resolvedImage,
          artistColor: color,
          artistInitials: initials,
        },
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: true,
        },
      });
    } catch (e) {
      // P2002 on the spotifyId means it was claimed in a race; anything else is a
      // slot-index collision we can retry with the next index.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (target.includes("spotify")) {
          return NextResponse.json({ error: "Artist already claimed" }, { status: 409 });
        }
        continue;
      }
      throw e;
    }
  }

  if (!artist) {
    return NextResponse.json({ error: "Não foi possível cadastrar, tente novamente" }, { status: 409 });
  }

  return NextResponse.json({ artist });
}

// PATCH /api/copa/[id]/claim — troca um artista já escolhido por outro (só durante REGISTRATION).
// body: { oldArtistId, artistSpotifyId, artistName, artistImage? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const { oldArtistId, artistSpotifyId, artistName, artistImage } = body as {
    oldArtistId: string;
    artistSpotifyId: string | null;
    artistName: string;
    artistImage?: string | null;
  };

  if (!oldArtistId) {
    return NextResponse.json({ error: "oldArtistId é obrigatório" }, { status: 400 });
  }
  if (!artistName?.trim()) {
    return NextResponse.json({ error: "Artist name required" }, { status: 400 });
  }
  if (!artistSpotifyId) {
    return NextResponse.json(
      { error: "Selecione um artista da busca (catálogo ou Spotify) — não é permitido texto livre" },
      { status: 400 },
    );
  }

  const [oldArtist, copa, localArtist, spotifyProfile] = await Promise.all([
    prisma.copaArtist.findUnique({ where: { id: oldArtistId } }),
    prisma.copaEdition.findUnique({ where: { id } }),
    prisma.artist.findUnique({ where: { spotifyId: artistSpotifyId } }),
    getSpotifyArtistById(artistSpotifyId),
  ]);

  if (!oldArtist || oldArtist.copaId !== id || oldArtist.ownerId !== userId) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
  if (!copa || copa.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Só é possível trocar artistas durante o registro" }, { status: 400 });
  }
  if (!localArtist && !spotifyProfile) {
    return NextResponse.json({ error: "Artista inválido" }, { status: 400 });
  }
  if (oldArtist.artistSpotifyId === artistSpotifyId) {
    return NextResponse.json({ error: "Esse já é o artista atual" }, { status: 400 });
  }

  const existingClaim = await prisma.copaArtist.findFirst({
    where: { copaId: id, artistSpotifyId, NOT: { id: oldArtistId } },
  });
  if (existingClaim) {
    return NextResponse.json({ error: "Artist already claimed" }, { status: 409 });
  }

  const color = getArtistColor(artistSpotifyId);
  const initials = getArtistInitials(artistName);
  let resolvedImage = artistImage?.trim() || null;
  if (!resolvedImage) {
    resolvedImage = localArtist?.imageUrl ?? spotifyProfile?.imageUrl ?? null;
  }

  try {
    const artist = await prisma.$transaction(async (tx) => {
      // Apaga o artista antigo (cascade remove os singles já definidos para ele —
      // é um artista diferente, o usuário precisa escolher as músicas de novo)
      // e recria na mesma posição (groupLetter/slotInGroup) para manter a ordem no time.
      await tx.copaArtist.delete({ where: { id: oldArtistId } });
      return tx.copaArtist.create({
        data: {
          copaId: id,
          ownerId: userId,
          groupLetter: oldArtist.groupLetter,
          slotInGroup: oldArtist.slotInGroup,
          artistSpotifyId,
          artistName: artistName.trim(),
          artistImage: resolvedImage,
          artistColor: color,
          artistInitials: initials,
        },
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: true,
        },
      });
    });
    return NextResponse.json({ artist });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Artist already claimed" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { artistId } = body as { artistId: string };

  const artist = await prisma.copaArtist.findUnique({ where: { id: artistId } });
  if (!artist || artist.copaId !== id || artist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa || copa.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Cannot remove after registration" }, { status: 400 });
  }

  await prisma.copaArtist.delete({ where: { id: artistId } });
  return NextResponse.json({ ok: true });
}
