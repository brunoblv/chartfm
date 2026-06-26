import { prisma } from "@/lib/prisma";
import { COPA_DAY_LABELS } from "@/lib/copa";

export type CopaNotificationType = "copa_stage" | "copa_fixture";

async function broadcastCopaNotification(
  type: CopaNotificationType,
  targetUrl: string,
  text: string,
): Promise<number> {
  const existingCount = await prisma.notification.count({
    where: { type, targetUrl },
  });
  if (existingCount > 0) return 0;

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  if (!allUsers.length) return 0;

  await prisma.notification.createMany({
    data: allUsers.map((u) => ({
      recipientId: u.id,
      actorId: null,
      type,
      text,
      targetUrl,
      read: false,
    })),
  });

  return allUsers.length;
}

/** Notifica todos os usuários quando um lote/etapa da Copa é aberto. */
export async function notifyCopaBatchOpened(copaId: string, batchOrder: number): Promise<number> {
  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { name: true },
  });
  if (!copa) return 0;

  const stageLabel = COPA_DAY_LABELS[batchOrder] ?? `Etapa ${batchOrder + 1}`;
  const targetUrl = `/copa/ao-vivo?copa=${copaId}&batch=${batchOrder}`;
  const text = `A etapa "${stageLabel}" da ${copa.name} está aberta! Vote nos jogos ao vivo.`;

  return broadcastCopaNotification("copa_stage", targetUrl, text);
}

/** Notifica todos os usuários quando um jogo individual passa a ficar ao vivo. */
export async function notifyCopaFixtureOpened(fixtureId: string): Promise<number> {
  const fixture = await prisma.copaFixture.findUnique({
    where: { id: fixtureId },
    select: {
      copaId: true,
      copa: { select: { name: true } },
      artistA: { select: { artistName: true } },
      artistB: { select: { artistName: true } },
    },
  });
  if (!fixture) return 0;

  const targetUrl = `/copa/jogo/${fixtureId}`;
  const text = `O jogo ${fixture.artistA.artistName} x ${fixture.artistB.artistName} está ao vivo na ${fixture.copa.name}! Vote agora.`;

  return broadcastCopaNotification("copa_fixture", targetUrl, text);
}
