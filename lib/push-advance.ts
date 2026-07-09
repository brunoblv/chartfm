import { prisma } from "@/lib/prisma";
import type { PushPhase, PushRound } from "@prisma/client";
import {
  syncPushPlaylistsOnPhaseAdvance,
  type PhasePlaylistSyncReport,
} from "@/lib/push-playlist-sync";
import { announcePushPhaseChange } from "@/lib/game-announcements";
import { onPushPhaseChanged } from "@/lib/social/events";

export const PUSH_PHASE_ORDER: PushPhase[] = ["SUBMISSION", "LISTENING", "RESULT"];

// RANKING é fase legada — hoje escuta e avaliação acontecem juntas em LISTENING.
export function normalizePushPhase(phase: PushPhase): PushPhase {
  return phase === "RANKING" ? "LISTENING" : phase;
}

export type PushAdvanceResult = {
  updated: PushRound;
  playlistSync: PhasePlaylistSyncReport | null;
};

// Avança a rodada para a próxima fase, com os mesmos efeitos do botão Avançar
// do admin: na virada SUBMISSION → LISTENING gera as playlists e marca o
// início da escuta; toda virada é anunciada no feed. Retorna null se a rodada
// já está em RESULT.
export async function advancePushRoundPhase(round: PushRound): Promise<PushAdvanceResult | null> {
  const idx = PUSH_PHASE_ORDER.indexOf(normalizePushPhase(round.phase));
  if (idx < 0 || idx >= PUSH_PHASE_ORDER.length - 1) return null;

  const updates: Partial<{
    phase: PushPhase;
    listeningEndsAt: Date;
    spotifyPlaylistId: string;
    youtubePlaylistId: string;
  }> = { phase: PUSH_PHASE_ORDER[idx + 1] };

  let playlistSync: PhasePlaylistSyncReport | null = null;

  // SUBMISSION → Escuta & Avaliação: revelação concluída → escuta começa agora
  if (normalizePushPhase(round.phase) === "SUBMISSION") {
    updates.listeningEndsAt = new Date();

    const submissions = await prisma.pushSubmission.findMany({
      where: { roundId: round.id },
      include: { song: { select: { title: true, artist: true } } },
    });

    if (submissions.length > 0) {
      playlistSync = await syncPushPlaylistsOnPhaseAdvance({
        roundId: round.id,
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

  const updated = await prisma.pushRound.update({
    where: { id: round.id },
    data: updates,
  });

  await announcePushPhaseChange(updated);
  onPushPhaseChanged(updated.id, updated.phase).catch((e) => console.error("[push-advance] onPushPhaseChanged", e));

  return { updated, playlistSync };
}

export type PushScheduleSyncResult = {
  roundId: string;
  number: number;
  phase: PushPhase;
  advanced: boolean;
};

// Reconcilia a rodada atual (a de maior número) com seus prazos: encerra as
// inscrições em submissionEndsAt e publica o resultado em rankingEndsAt.
// Avança no máximo uma fase por chamada; idempotente — pode rodar de hora em
// hora (cron) sem efeito colateral.
export async function syncPushRoundToSchedule(
  now: Date = new Date(),
): Promise<PushScheduleSyncResult | null> {
  const round = await prisma.pushRound.findFirst({ orderBy: { number: "desc" } });
  if (!round) return null;

  const phase = normalizePushPhase(round.phase);
  const deadline =
    phase === "SUBMISSION" ? round.submissionEndsAt
    : phase === "LISTENING" ? round.rankingEndsAt
    : null;

  if (!deadline || now < deadline) {
    return { roundId: round.id, number: round.number, phase: round.phase, advanced: false };
  }

  const result = await advancePushRoundPhase(round);
  return {
    roundId: round.id,
    number: round.number,
    phase: result?.updated.phase ?? round.phase,
    advanced: result !== null,
  };
}
