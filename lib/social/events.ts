import { prisma } from "@/lib/prisma";
import { SocialEventType, SocialPostStatus } from "@prisma/client";
import { registerSocialEvent } from "@/lib/social/generate-post";
import { loadAlbumReviewContent } from "@/lib/social/content/album-review";

const ALBUM_REVIEW_COOLDOWN_DAYS = 14;

/** §12 — nova edição de chart publicada. */
export async function onChartPublished(chart: "GLOBAL100" | "AIRPLAY" | "ALBUMS", weekIndex: number) {
  const eventType =
    chart === "GLOBAL100"
      ? SocialEventType.GLOBAL100_PUBLISHED
      : chart === "AIRPLAY"
        ? SocialEventType.AIRPLAY_PUBLISHED
        : SocialEventType.ALBUMS_CHART_PUBLISHED;
  return registerSocialEvent({ eventType, entityType: "chart_week", entityId: String(weekIndex) });
}

/**
 * §11 — chamar após criar/atualizar um AlbumReview. Só cria post ao atingir o
 * marco de 2 avaliações; publicações seguintes do mesmo álbum respeitam um
 * cooldown (não posta de novo o mesmo álbum toda hora).
 */
export async function checkAlbumReviewMilestone(albumId: number) {
  const content = await loadAlbumReviewContent(albumId);
  if (!content) return null; // ainda não tem 2 reviews

  const recentPost = await prisma.socialPost.findFirst({
    where: {
      eventType: SocialEventType.ALBUM_REVIEW_MILESTONE,
      entityId: String(albumId),
      status: SocialPostStatus.PUBLISHED,
      publishedAt: { gte: new Date(Date.now() - ALBUM_REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentPost) return null;

  return registerSocialEvent({
    eventType: SocialEventType.ALBUM_REVIEW_MILESTONE,
    entityType: "album",
    entityId: String(albumId),
    payload: { rating: content.rating, reviewCount: content.reviewCount },
  });
}

/** §10 — álbum vencedor de uma edição do Clube do Álbum. */
export async function onAlbumClubWinner(roundId: string, albumId: number) {
  return registerSocialEvent({ eventType: SocialEventType.ALBUM_CLUB_WINNER, entityType: "album", entityId: String(albumId), payload: { roundId } });
}

/** §8 — mudança de fase do Push (abertura de inscrições/votação). */
export async function onPushPhaseChanged(roundId: string, phase: string) {
  return registerSocialEvent({ eventType: SocialEventType.PUSH_PHASE_CHANGE, entityType: "push_round", entityId: roundId, payload: { phase } });
}

/** §9 — rodada da Copa abre para votação. */
export async function onCopaRoundStart(copaId: string) {
  return registerSocialEvent({ eventType: SocialEventType.COPA_ROUND_START, entityType: "copa_edition", entityId: copaId });
}

/** §9 — resultado de uma rodada/dia da Copa. */
export async function onCopaRoundResult(copaId: string) {
  return registerSocialEvent({ eventType: SocialEventType.COPA_ROUND_RESULT, entityType: "copa_edition", entityId: copaId });
}

/** §9 — resultado final da Copa (campeão). Prioridade CRITICAL. */
export async function onCopaFinished(copaId: string) {
  return registerSocialEvent({ eventType: SocialEventType.COPA_FINAL_RESULT, entityType: "copa_edition", entityId: copaId });
}

/** Votação da Semana abre. */
export async function onWeeklyPollOpened(weekIndex: number) {
  return registerSocialEvent({ eventType: SocialEventType.WEEKLY_POLL_OPEN, entityType: "weekly_poll", entityId: String(weekIndex) });
}
