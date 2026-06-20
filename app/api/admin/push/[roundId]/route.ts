import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { PushPhase } from "@prisma/client";
import { getMyTrlOwnerUser, getSpotifyUserAccessToken, replaceTracksInSpotifyPlaylist } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHASE_ORDER: PushPhase[] = ["SUBMISSION", "LISTENING", "RANKING", "RESULT"];

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
  }> = {};

  if (body.advancePhase) {
    const idx = PHASE_ORDER.indexOf(round.phase);
    if (idx < PHASE_ORDER.length - 1) {
      updates.phase = PHASE_ORDER[idx + 1];

      // SUBMISSION → LISTENING: substituir faixas na playlist fixa
      if (round.phase === "SUBMISSION") {
        const playlistId = process.env.PUSH_SPOTIFY_PLAYLIST_ID ?? round.spotifyPlaylistId ?? null;
        if (playlistId) {
          try {
            const submissions = await prisma.pushSubmission.findMany({
              where: { roundId },
              select: { spotifyTrackId: true },
            });
            const uris = submissions.map((s) => `spotify:track:${s.spotifyTrackId}`);
            const ownerUser = await getMyTrlOwnerUser();
            if (ownerUser?.id) {
              const token = await getSpotifyUserAccessToken(ownerUser.id);
              if (token) await replaceTracksInSpotifyPlaylist(token, playlistId, uris);
            }
            updates.spotifyPlaylistId = playlistId;
          } catch (err) {
            console.error("[push] failed to update Spotify playlist on phase advance", err);
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

  const updated = await prisma.pushRound.update({
    where: { id: roundId },
    data: updates,
  });

  return NextResponse.json(updated);
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
