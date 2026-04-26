import { prisma } from "@/lib/prisma";

type NotifInput = {
  recipientId: string;
  actorId?: string;
  type: string;
  text: string;
  targetUrl?: string;
};

export async function createNotification(input: NotifInput): Promise<void> {
  if (input.recipientId === input.actorId) return;
  await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      text: input.text,
      targetUrl: input.targetUrl ?? null,
    },
  });
}
