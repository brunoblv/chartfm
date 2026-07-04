import { prisma } from "@/lib/prisma";
import { createSystemFeedPost } from "@/lib/system-feed";

export type AdminBroadcastInput = {
  text: string;
  targetUrl?: string | null;
  notifyType?: string;
  feedKind?: string;
};

/** Notifica todos os usuários e publica post no feed da ChartFM (sem deduplicação). */
export async function broadcastAdminAnnouncement(input: AdminBroadcastInput): Promise<number> {
  const { text, targetUrl, notifyType = "admin_announcement", feedKind = "admin_announcement" } = input;

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  if (!allUsers.length) return 0;

  const link = targetUrl ?? null;

  await prisma.notification.createMany({
    data: allUsers.map((u) => ({
      recipientId: u.id,
      actorId: null,
      type: notifyType,
      text,
      targetUrl: link,
      read: false,
    })),
  });

  await createSystemFeedPost(feedKind, text, link);
  return allUsers.length;
}
