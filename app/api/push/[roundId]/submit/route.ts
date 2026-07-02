import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getSpotifyTrackMetadataById } from "@/lib/spotify-server";
import { upsertSongFromSpotifyMetadata } from "@/lib/upsert-song-from-spotify-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isWithinOneYear(releaseDate: Date | null): boolean {
  if (!releaseDate) return false;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return releaseDate >= oneYearAgo;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { roundId } = await params;
  const body = (await req.json()) as { spotifyTrackId?: string };
  const spotifyTrackId = typeof body.spotifyTrackId === "string" ? body.spotifyTrackId.trim() : "";

  if (!spotifyTrackId) {
    return NextResponse.json({ error: "spotifyTrackId obrigatório" }, { status: 400 });
  }

  const round = await prisma.pushRound.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });
  if (round.phase !== "SUBMISSION") {
    return NextResponse.json({ error: "Fora do período de inscrição" }, { status: 400 });
  }

  const existing = await prisma.pushSubmission.findUnique({
    where: { roundId_userId: { roundId, userId: session.user.id } },
  });

  const alreadyUsed = await prisma.pushSubmission.findUnique({
    where: { spotifyTrackId },
  });
  if (alreadyUsed && alreadyUsed.id !== existing?.id) {
    return NextResponse.json({ error: "Esta música já foi indicada em outra rodada" }, { status: 400 });
  }

  const metadata = await getSpotifyTrackMetadataById(spotifyTrackId);
  if (!metadata) {
    return NextResponse.json({ error: "Música não encontrada no Spotify" }, { status: 404 });
  }

  if (!isWithinOneYear(metadata.album.releaseDate)) {
    return NextResponse.json({
      error: "A música deve ter sido lançada nos últimos 12 meses",
    }, { status: 400 });
  }

  const upserted = await upsertSongFromSpotifyMetadata(metadata);
  if (!upserted.ok) {
    return NextResponse.json({ error: upserted.error }, { status: upserted.status });
  }

  const submission = existing
    ? await prisma.pushSubmission.update({
        where: { id: existing.id },
        data: { songId: upserted.song.id, spotifyTrackId },
        include: {
          song: { select: { title: true, artist: true, spotifyUrl: true } },
        },
      })
    : await prisma.pushSubmission.create({
        data: {
          roundId,
          userId: session.user.id,
          songId: upserted.song.id,
          spotifyTrackId,
        },
        include: {
          song: { select: { title: true, artist: true, spotifyUrl: true } },
        },
      });

  return NextResponse.json({
    id: submission.id,
    spotifyTrackId: submission.spotifyTrackId,
    song: {
      title: submission.song.title,
      artist: submission.song.artist,
      coverUrl: null,
      spotifyUrl: submission.song.spotifyUrl,
    },
  });
}
