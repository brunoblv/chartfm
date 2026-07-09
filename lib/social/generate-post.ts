import { prisma } from "@/lib/prisma";
import { SocialEventType, SocialPostStatus, Prisma } from "@prisma/client";
import { priorityForEventType, expiresAtForEventType } from "@/lib/social/priority";

const IN_FLIGHT: SocialPostStatus[] = [
  SocialPostStatus.PENDING,
  SocialPostStatus.SCHEDULED,
  SocialPostStatus.GENERATING,
  SocialPostStatus.READY,
  SocialPostStatus.PUBLISHING,
];

type CreateSocialPostInput = {
  eventType: SocialEventType;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
};

/**
 * Registra o SocialEvent e, se elegível (automação ligada + sem post do mesmo
 * tipo/entidade já em andamento), cria o SocialPost PENDING na fila.
 * Retorna null quando não cria post (automação desligada ou já em andamento) —
 * nunca lança.
 */
export async function registerSocialEvent(input: CreateSocialPostInput) {
  const toggle = await prisma.socialAutomationToggle.findUnique({ where: { eventType: input.eventType } });
  if (toggle && !toggle.enabled) return null;

  const inFlight = await prisma.socialPost.findFirst({
    where: { eventType: input.eventType, entityId: input.entityId, status: { in: IN_FLIGHT } },
    select: { id: true },
  });
  if (inFlight) return null;

  const event = await prisma.socialEvent.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });

  const now = new Date();
  return prisma.socialPost.create({
    data: {
      eventId: event.id,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      priority: priorityForEventType(input.eventType),
      expiresAt: expiresAtForEventType(input.eventType, now),
      platforms: [],
    },
  });
}
