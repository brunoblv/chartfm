import type { SocialCredentialPlatform, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SocialPostMetricRow = {
  postId: string;
  eventType: string;
  platform: SocialPlatform;
  publishedAt: string | null;
  caption: string | null;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  clicks: number | null;
  /** (curtidas + comentários + compartilhamentos + salvamentos) ÷ alcance, em %. */
  engagementRate: number | null;
  fetchedAt: string | null;
  error: string | null;
};

export type SocialAccountRow = {
  platform: SocialCredentialPlatform;
  date: string;
  followers: number | null;
  follows: number | null;
  mediaCount: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
  interactions: number | null;
  error: string | null;
  fetchedAt: string;
};

export type PlatformTotals = {
  platform: SocialPlatform;
  posts: number;
  withData: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  views: number;
  avgEngagementRate: number | null;
};

export type SocialAnalyticsData = {
  days: number;
  posts: SocialPostMetricRow[];
  accounts: SocialAccountRow[];
  totals: PlatformTotals[];
  /** Publicações já publicadas que ainda não têm nenhuma coleta registrada. */
  pendingCollection: number;
  lastCollectedAt: string | null;
};

export function engagementRate(m: { likes: number | null; comments: number | null; shares: number | null; saves: number | null; reach: number | null }): number | null {
  if (!m.reach) return null;
  const interactions = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
  return Math.round((interactions / m.reach) * 1000) / 10;
}

export function computeTotals(rows: SocialPostMetricRow[]): PlatformTotals[] {
  const byPlatform = new Map<SocialPlatform, PlatformTotals & { rateSum: number; rateCount: number }>();
  for (const row of rows) {
    let t = byPlatform.get(row.platform);
    if (!t) {
      t = { platform: row.platform, posts: 0, withData: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, views: 0, avgEngagementRate: null, rateSum: 0, rateCount: 0 };
      byPlatform.set(row.platform, t);
    }
    t.posts++;
    if (row.fetchedAt && !row.error) t.withData++;
    t.likes += row.likes ?? 0;
    t.comments += row.comments ?? 0;
    t.shares += row.shares ?? 0;
    t.saves += row.saves ?? 0;
    t.reach += row.reach ?? 0;
    t.views += row.views ?? 0;
    if (row.engagementRate !== null) {
      t.rateSum += row.engagementRate;
      t.rateCount++;
    }
  }
  return [...byPlatform.values()].map(({ rateSum, rateCount, ...t }) => ({
    ...t,
    avgEngagementRate: rateCount ? Math.round((rateSum / rateCount) * 10) / 10 : null,
  }));
}

function captionFor(platform: SocialPlatform, post: { captionInstagram: string | null; captionFacebook: string | null }): string | null {
  if (platform === "FACEBOOK") return post.captionFacebook;
  if (platform === "INSTAGRAM_FEED") return post.captionInstagram;
  return null;
}

export async function getSocialAnalyticsData(days = 30, now = new Date()): Promise<SocialAnalyticsData> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const [publications, accounts] = await Promise.all([
    prisma.socialPostPublication.findMany({
      where: { platform: { in: ["INSTAGRAM_FEED", "INSTAGRAM_STORY", "FACEBOOK"] }, status: "PUBLISHED", publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      include: {
        post: {
          select: {
            eventType: true,
            captionInstagram: true,
            captionFacebook: true,
            metrics: true,
          },
        },
      },
    }),
    prisma.socialAccountSnapshot.findMany({
      where: { platform: { in: ["INSTAGRAM", "FACEBOOK"] }, date: { gte: new Date(since.getTime() - DAY_MS) } },
      orderBy: { date: "asc" },
    }),
  ]);

  let lastCollectedAt: Date | null = null;
  let pendingCollection = 0;
  const posts: SocialPostMetricRow[] = publications.map((pub) => {
    const m = pub.post.metrics.find((x) => x.platform === pub.platform) ?? null;
    if (!m) pendingCollection++;
    if (m && (!lastCollectedAt || m.fetchedAt > lastCollectedAt)) lastCollectedAt = m.fetchedAt;
    const values = {
      likes: m?.likes ?? null,
      comments: m?.comments ?? null,
      shares: m?.shares ?? null,
      saves: m?.saves ?? null,
      reach: m?.reach ?? null,
    };
    return {
      postId: pub.socialPostId,
      eventType: pub.post.eventType,
      platform: pub.platform,
      publishedAt: pub.publishedAt?.toISOString() ?? null,
      caption: captionFor(pub.platform, pub.post),
      permalink: m?.permalink ?? null,
      ...values,
      impressions: m?.impressions ?? null,
      views: m?.views ?? null,
      clicks: m?.clicks ?? null,
      engagementRate: engagementRate(values),
      fetchedAt: m?.fetchedAt.toISOString() ?? null,
      error: m?.error ?? null,
    };
  });

  return {
    days,
    posts,
    accounts: accounts.map((a) => ({
      platform: a.platform,
      date: a.date.toISOString().slice(0, 10),
      followers: a.followers,
      follows: a.follows,
      mediaCount: a.mediaCount,
      reach: a.reach,
      views: a.views,
      profileViews: a.profileViews,
      accountsEngaged: a.accountsEngaged,
      interactions: a.interactions,
      error: a.error,
      fetchedAt: a.fetchedAt.toISOString(),
    })),
    totals: computeTotals(posts),
    pendingCollection,
    lastCollectedAt: (lastCollectedAt as Date | null)?.toISOString() ?? null,
  };
}

const CSV_COLUMNS: (keyof SocialPostMetricRow)[] = [
  "publishedAt",
  "platform",
  "eventType",
  "postId",
  "permalink",
  "likes",
  "comments",
  "shares",
  "saves",
  "reach",
  "impressions",
  "views",
  "clicks",
  "engagementRate",
  "fetchedAt",
  "error",
  "caption",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Evita injeção de fórmula ao abrir no Excel/Sheets (legendas são texto livre).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function postsToCsv(rows: SocialPostMetricRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(","));
  // BOM para o Excel abrir acentos corretamente.
  return `﻿${lines.join("\r\n")}\r\n`;
}
