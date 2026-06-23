import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getArtistColor, getArtistInitials } from "@/lib/copa";

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

  // Find next available group slot (fill groups A-P, 4 artists each)
  const allArtists = await prisma.copaArtist.findMany({
    where: { copaId: id },
    select: { groupLetter: true, slotInGroup: true },
  });

  const letters = "ABCDEFGHIJKLMNOP".split("");
  let targetGroup = "";
  let targetSlot = 0;

  for (const letter of letters) {
    const inGroup = allArtists.filter((a) => a.groupLetter === letter);
    if (inGroup.length < 4) {
      targetGroup = letter;
      const usedSlots = new Set(inGroup.map((a) => a.slotInGroup));
      for (let s = 0; s < 4; s++) {
        if (!usedSlots.has(s)) { targetSlot = s; break; }
      }
      break;
    }
  }

  if (!targetGroup) {
    return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
  }

  const color = artistImage ? getArtistColor(artistSpotifyId) : getArtistColor(artistSpotifyId);
  const initials = getArtistInitials(artistName);

  const artist = await prisma.copaArtist.create({
    data: {
      copaId: id,
      ownerId: session.user.id,
      groupLetter: targetGroup,
      slotInGroup: targetSlot,
      artistSpotifyId: artistSpotifyId ?? null,
      artistName: artistName.trim(),
      artistImage: artistImage ?? null,
      artistColor: color,
      artistInitials: initials,
    },
    include: {
      owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
      singles: true,
    },
  });

  return NextResponse.json({ artist });
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
