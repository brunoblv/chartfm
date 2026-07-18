import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { notifyTelegramEventSafe } from "@/lib/telegram";

export const SYSTEM_FEED_TAG = "system-feed-posts";

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

  const { revalidateTag } = await import("next/cache");
  revalidateTag(SYSTEM_FEED_TAG, "max");

  notifyTelegramEventSafe({ kind, text, targetUrl });
}

type SystemFeedRow = { id: string; text: string; targetUrl: string | null; createdAt: string };

async function fetchSystemFeedRows(limit: number): Promise<SystemFeedRow[]> {
  const rows = await prisma.systemFeedPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    targetUrl: r.targetUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}

function getSystemFeedRows(limit: number): Promise<SystemFeedRow[]> {
  return unstable_cache(() => fetchSystemFeedRows(limit), [`system-feed-posts-${limit}`], {
    revalidate: 60,
    tags: [SYSTEM_FEED_TAG],
  })();
}

export async function getSystemFeedPosts(locale: Locale, limit = 10): Promise<SystemFeedItem[]> {
  const rows = await getSystemFeedRows(limit);
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    targetUrl: r.targetUrl,
    postedAgo: formatRelativeTime(locale, new Date(r.createdAt)),
    createdAt: r.createdAt,
  }));
}
