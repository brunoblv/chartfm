import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { PushPhase } from "@prisma/client";
import { syncPushPlaylistsOnPhaseAdvance } from "@/lib/push-playlist-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHASE_ORDER: PushPhase[] = ["SUBMISSION", "LISTENING", "RESULT"];

function normalizePushPhase(phase: PushPhase): PushPhase {
  return phase === "RANKING" ? "LISTENING" : phase;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  const body = (await req.json()) as {
    advancePhase?: boolean;
    phase?: PushPhase;
    title?: string;
    season?: number;
    submissionEndsAt?: string;
    listeningEndsAt?: string;
    rankingEndsAt?: string;
    spotifyPlaylistId?: string;
    youtubePlaylistId?: string;
  };

  const round = await prisma.pushRound.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });

  const updates: Partial<{
    phase: PushPhase;
    title: string | null;
    season: number;
    submissionEndsAt: Date;
    listeningEndsAt: Date;
    rankingEndsAt: Date;
    spotifyPlaylistId: string | null;
    youtubePlaylistId: string | null;
  }> = {};

  let playlistSync: Awaited<ReturnType<typeof syncPushPlaylistsOnPhaseAdvance>> | null = null;

  if (body.advancePhase) {
    const idx = PHASE_ORDER.indexOf(normalizePushPhase(round.phase));

    if (idx < PHASE_ORDER.length - 1) {
      updates.phase = PHASE_ORDER[idx + 1];

      // SUBMISSION → Escuta & Avaliação: revelação concluída → escuta começa agora
      if (round.phase === "SUBMISSION") {
        updates.listeningEndsAt = new Date();

        const submissions = await prisma.pushSubmission.findMany({
          where: { roundId },
          include: { song: { select: { title: true, artist: true } } },
        });

        if (submissions.length > 0) {
          playlistSync = await syncPushPlaylistsOnPhaseAdvance({
            roundId,
            roundNumber: round.number,
            season: round.season,
            trackIds: submissions.map((s) => s.spotifyTrackId),
            tracks: submissions.map((s) => ({ title: s.song.title, artist: s.song.artist })),
            existingYoutubePlaylistId: round.youtubePlaylistId,
          });

          if (playlistSync.spotify?.ok) {
            updates.spotifyPlaylistId = playlistSync.spotify.playlistId;
          } else if (playlistSync.spotify && !playlistSync.spotify.ok) {
            console.error("[push] Spotify playlist on phase advance:", playlistSync.spotify.message);
          }

          if (playlistSync.youtube?.ok) {
            updates.youtubePlaylistId = playlistSync.youtube.playlistId;
          } else if (playlistSync.youtube && !playlistSync.youtube.ok) {
            console.error("[push] YouTube playlist on phase advance:", playlistSync.youtube.message);
          }
        }
      }
    }
  } else if (body.phase) {
    updates.phase = body.phase;
  }

  if (body.title !== undefined) updates.title = body.title || null;
  if (body.season !== undefined) updates.season = body.season;
  if (body.submissionEndsAt) updates.submissionEndsAt = new Date(body.submissionEndsAt);
  if (body.listeningEndsAt) updates.listeningEndsAt = new Date(body.listeningEndsAt);
  if (body.rankingEndsAt) updates.rankingEndsAt = new Date(body.rankingEndsAt);
  if (body.spotifyPlaylistId !== undefined) updates.spotifyPlaylistId = body.spotifyPlaylistId || null;
  if (body.youtubePlaylistId !== undefined) updates.youtubePlaylistId = body.youtubePlaylistId || null;

  const submissionEndsAt = updates.submissionEndsAt ?? round.submissionEndsAt;
  const listeningEndsAt = updates.listeningEndsAt ?? round.listeningEndsAt;
  const rankingEndsAt = updates.rankingEndsAt ?? round.rankingEndsAt;

  if (listeningEndsAt < submissionEndsAt) {
    return NextResponse.json({ error: "A escuta deve começar após o fim das inscrições" }, { status: 400 });
  }
  if (rankingEndsAt <= listeningEndsAt) {
    return NextResponse.json({ error: "O fim da escuta deve ser após o início" }, { status: 400 });
  }

  const updated = await prisma.pushRound.update({
    where: { id: roundId },
    data: updates,
  });

  return NextResponse.json({ ...updated, playlistSync });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  await prisma.pushRound.delete({ where: { id: roundId } });
  return NextResponse.json({ ok: true });
}
