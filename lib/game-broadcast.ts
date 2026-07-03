import { prisma } from "@/lib/prisma";
import { createSystemFeedPost } from "@/lib/system-feed";

/** Notifica todos os usuários e publica post no feed da ChartFM. Deduplica por type + targetUrl. */
export async function broadcastGameAnnouncement(
  type: string,
  targetUrl: string,
  text: string,
  feedKind: string,
  linkUrl?: string,
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

  await createSystemFeedPost(feedKind, text, linkUrl ?? targetUrl);
  return allUsers.length;
}
