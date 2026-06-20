import { prisma } from "@/lib/prisma";

export type GlobalWeeklyNotificationType = "global_chart" | "global_airplay" | "global_albums";

const DEDUPE_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

export async function sendGlobalWeeklyNotification(
  type: GlobalWeeklyNotificationType,
  targetUrl: string,
  text: string,
): Promise<number> {
  const existingCount = await prisma.notification.count({
    where: {
      type,
      targetUrl,
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
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
