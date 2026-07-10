import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type EditorialArticleStat = {
  slug: string;
  title: string;
  publishedAt: string;
  views7d: number;
  views30d: number;
  viewsAllTime: number;
};

export type EditorialAnalytics = {
  topArticles: EditorialArticleStat[];
  topArticleWeek: EditorialArticleStat | null;
  topArticleMonth: EditorialArticleStat | null;
  tagLeaderboard: { tag: string; views: number; articleCount: number }[];
  viewsOverTime: { day: string; views: number }[];
};

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value as string[];
}

export async function getEditorialAnalytics(now = new Date()): Promise<EditorialAnalytics> {
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);

  const [allTimeRows, recentRows, posts] = await Promise.all([
    prisma.editorialPostDailyView.groupBy({ by: ["slug"], _sum: { views: true } }),
    prisma.editorialPostDailyView.findMany({
      where: { date: { gte: d30 } },
      select: { slug: true, date: true, views: true },
    }),
    prisma.editorialPost.findMany({
      select: { slug: true, title: true, publishedAt: true, tags: true },
    }),
  ]);

  const viewsAllTime = new Map<string, number>();
  for (const row of allTimeRows) viewsAllTime.set(row.slug, row._sum.views ?? 0);

  const views7d = new Map<string, number>();
  const views30d = new Map<string, number>();
  const dayTotals = new Map<string, number>();
  for (const row of recentRows) {
    views30d.set(row.slug, (views30d.get(row.slug) ?? 0) + row.views);
    if (row.date >= d7) views7d.set(row.slug, (views7d.get(row.slug) ?? 0) + row.views);
    const dayKey = row.date.toISOString().slice(0, 10);
    dayTotals.set(dayKey, (dayTotals.get(dayKey) ?? 0) + row.views);
  }

  const stats: EditorialArticleStat[] = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    publishedAt: post.publishedAt.toISOString().slice(0, 10),
    views7d: views7d.get(post.slug) ?? 0,
    views30d: views30d.get(post.slug) ?? 0,
    viewsAllTime: viewsAllTime.get(post.slug) ?? 0,
  }));

  const topArticles = [...stats].sort((a, b) => b.viewsAllTime - a.viewsAllTime).slice(0, 20);

  const topArticleWeek = stats.reduce<EditorialArticleStat | null>(
    (best, s) => (s.views7d > 0 && (!best || s.views7d > best.views7d) ? s : best),
    null,
  );
  const topArticleMonth = stats.reduce<EditorialArticleStat | null>(
    (best, s) => (s.views30d > 0 && (!best || s.views30d > best.views30d) ? s : best),
    null,
  );

  const tagStats = new Map<string, { views: number; articleCount: number }>();
  for (const post of posts) {
    const views = viewsAllTime.get(post.slug) ?? 0;
    for (const tag of parseTags(post.tags)) {
      const entry = tagStats.get(tag) ?? { views: 0, articleCount: 0 };
      entry.views += views;
      entry.articleCount += 1;
      tagStats.set(tag, entry);
    }
  }
  const tagLeaderboard = [...tagStats.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.views - a.views);

  const viewsOverTime = [...dayTotals.entries()]
    .map(([day, views]) => ({ day, views }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { topArticles, topArticleWeek, topArticleMonth, tagLeaderboard, viewsOverTime };
}
