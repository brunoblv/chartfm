import { SocialEventType, SocialPostPriority } from "@prisma/client";

const HOUR = 60 * 60 * 1000;

/** Prioridade padrão por tipo de evento, seção 6 do spec. */
export function priorityForEventType(eventType: SocialEventType): SocialPostPriority {
  switch (eventType) {
    case SocialEventType.COPA_FINAL_RESULT:
    case SocialEventType.WEEKLY_POLL_OPEN:
      return SocialPostPriority.CRITICAL;
    case SocialEventType.GLOBAL100_PUBLISHED:
    case SocialEventType.AIRPLAY_PUBLISHED:
    case SocialEventType.ALBUMS_CHART_PUBLISHED:
    case SocialEventType.PUSH_PHASE_CHANGE:
    case SocialEventType.COPA_ROUND_START:
    case SocialEventType.COPA_ROUND_RESULT:
      return SocialPostPriority.HIGH;
    case SocialEventType.ALBUM_CLUB_WINNER:
      return SocialPostPriority.NORMAL;
    case SocialEventType.ALBUM_REVIEW_MILESTONE:
      return SocialPostPriority.NORMAL;
    default:
      return SocialPostPriority.LOW;
  }
}

/** Prazo de validade — conteúdo com prazo (votações, fases) expira; evergreen (avaliações) fica null. */
export function expiresAtForEventType(eventType: SocialEventType, now: Date): Date | null {
  switch (eventType) {
    case SocialEventType.WEEKLY_POLL_OPEN:
      return new Date(now.getTime() + 48 * HOUR);
    case SocialEventType.COPA_ROUND_START:
    case SocialEventType.COPA_ROUND_RESULT:
      return new Date(now.getTime() + 24 * HOUR);
    case SocialEventType.COPA_FINAL_RESULT:
      return new Date(now.getTime() + 72 * HOUR);
    case SocialEventType.PUSH_PHASE_CHANGE:
      return new Date(now.getTime() + 48 * HOUR);
    default:
      return null; // evergreen: charts, avaliações, vencedor do clube
  }
}
