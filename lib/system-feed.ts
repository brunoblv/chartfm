import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { notifyTelegramEventSafe } from "@/lib/telegram";

export type SystemFeedItem = {
  id: string;
  text: string;
  targetUrl: string | null;
  postedAgo: string;
  createdAt: string;
};

/** Cria o post "da casa" (ChartFM) exibido no feed — Copa/Push publicados ou rodada avançou. */
export async function createSystemFeedPost(
  kind: string,
  text: string,
  targetUrl?: string | null,
): Promise<void> {
  await prisma.systemFeedPost.create({
    data: { kind, text, targetUrl: targetUrl ?? null },
  });

  notifyTelegramEventSafe({ kind, text, targetUrl });
}

export async function getSystemFeedPosts(locale: Locale, limit = 10): Promise<SystemFeedItem[]> {
  const rows = await prisma.systemFeedPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    targetUrl: r.targetUrl,
    postedAgo: formatRelativeTime(locale, r.createdAt),
    createdAt: r.createdAt.toISOString(),
  }));
}
