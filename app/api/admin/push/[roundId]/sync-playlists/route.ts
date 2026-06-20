import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { syncPushPlaylistsOnPhaseAdvance } from "@/lib/push-playlist-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;

  const round = await prisma.pushRound.findUnique({
    where: { id: roundId },
    include: {
      submissions: {
        include: { song: { select: { title: true, artist: true } } },
      },
    },
  });

  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });

  if (round.submissions.length === 0) {
    return NextResponse.json({ error: "Nenhuma música inscrita nesta rodada." }, { status: 400 });
  }

  const playlistSync = await syncPushPlaylistsOnPhaseAdvance({
    roundId: round.id,
    roundNumber: round.number,
    season: round.season,
    trackIds: round.submissions.map((s) => s.spotifyTrackId),
    tracks: round.submissions.map((s) => ({ title: s.song.title, artist: s.song.artist })),
    existingYoutubePlaylistId: round.youtubePlaylistId,
  });

  const updated = await prisma.pushRound.findUnique({
    where: { id: roundId },
    select: { spotifyPlaylistId: true, youtubePlaylistId: true },
  });

  const spotifyOk = playlistSync.spotify?.ok ?? false;
  const youtubeOk = playlistSync.youtube?.ok ?? false;
  const anyOk = spotifyOk || youtubeOk;
  const allOk =
    (!playlistSync.spotify || spotifyOk) &&
    (!playlistSync.youtube || youtubeOk);

  return NextResponse.json(
    {
      spotifyPlaylistId: updated?.spotifyPlaylistId ?? null,
      youtubePlaylistId: updated?.youtubePlaylistId ?? null,
      playlistSync,
      ok: allOk,
      partial: anyOk && !allOk,
    },
    { status: allOk ? 200 : anyOk ? 207 : 502 },
  );
}
