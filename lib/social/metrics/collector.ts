import { Prisma, type SocialCredentialPlatform, type SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSocialAccessToken, resolveSocialAccountId } from "@/lib/social/credentials/token-resolver";
import { fetchFacebookPageSnapshot, fetchFacebookPostMetrics } from "@/lib/social/metrics/facebook";
import { fetchInstagramAccountSnapshot, fetchInstagramMediaMetrics } from "@/lib/social/metrics/instagram";
import type { AccountSnapshotResult, PostMetricResult } from "@/lib/social/metrics/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const METRIC_PLATFORMS: SocialPlatform[] = ["INSTAGRAM_FEED", "INSTAGRAM_STORY", "FACEBOOK"];
/** Depois disso o post para de ser atualizado (os números praticamente não mudam mais). */
export const METRICS_WINDOW_DAYS = 60;
// Teto por execução: cada post custa 2–10 chamadas à Graph API (fallback métrica a métrica).
const MAX_POSTS_PER_RUN = 60;

/**
 * Frequência decrescente com a idade do post, para caber no rate limit da Graph API
 * com o cron rodando de hora em hora.
 */
export function isMetricDue(platform: SocialPlatform, publishedAt: Date, lastFetchedAt: Date | null, now: Date): boolean {
  if (!lastFetchedAt) return true;
  const age = now.getTime() - publishedAt.getTime();
  const sinceLast = now.getTime() - lastFetchedAt.getTime();

  // Insights de Story só existem enquanto ele está no ar (24h).
  if (platform === "INSTAGRAM_STORY") return age <= 26 * HOUR_MS && sinceLast >= HOUR_MS - 5 * 60 * 1000;

  if (age > METRICS_WINDOW_DAYS * DAY_MS) return false;
  if (age <= 2 * DAY_MS) return sinceLast >= HOUR_MS - 5 * 60 * 1000;
  if (age <= 7 * DAY_MS) return sinceLast >= 6 * HOUR_MS;
  return sinceLast >= DAY_MS;
}

/** Data "de calendário" em São Paulo, gravada como meia-noite UTC (coluna @db.Date). */
export function saoPauloDate(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

type Credentials = { token: string; accountId: string } | { error: string };

async function loadCredentials(platform: SocialCredentialPlatform): Promise<Credentials> {
  const [token, accountId] = await Promise.all([resolveSocialAccessToken(platform), resolveSocialAccountId(platform)]);
  if (!token || !accountId) return { error: `${platform === "FACEBOOK" ? "Facebook" : "Instagram"} não configurado (token/ID da conta ausente)` };
  return { token, accountId };
}

export type CollectSummary = {
  checked: number;
  updated: number;
  failed: number;
  skippedNotDue: number;
  deferred: number;
  errors: { postId: string; platform: SocialPlatform; error: string }[];
  accounts: { platform: SocialCredentialPlatform; ok: boolean; error?: string }[];
};

export async function collectSocialMetrics(opts: { now?: Date; force?: boolean } = {}): Promise<CollectSummary> {
  const now = opts.now ?? new Date();
  const summary: CollectSummary = { checked: 0, updated: 0, failed: 0, skippedNotDue: 0, deferred: 0, errors: [], accounts: [] };

  const creds: Record<"FACEBOOK" | "INSTAGRAM", Credentials> = {
    INSTAGRAM: await loadCredentials("INSTAGRAM"),
    FACEBOOK: await loadCredentials("FACEBOOK"),
  };

  await collectAccountSnapshots(creds, now, summary);

  const publications = await prisma.socialPostPublication.findMany({
    where: {
      platform: { in: METRIC_PLATFORMS },
      status: "PUBLISHED",
      externalId: { not: null },
      publishedAt: { gte: new Date(now.getTime() - METRICS_WINDOW_DAYS * DAY_MS) },
    },
    select: { socialPostId: true, platform: true, externalId: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });
  const existing = await prisma.socialPostMetric.findMany({
    where: { socialPostId: { in: publications.map((p) => p.socialPostId) } },
    select: { socialPostId: true, platform: true, fetchedAt: true },
  });
  const lastFetched = new Map(existing.map((m) => [`${m.socialPostId}:${m.platform}`, m.fetchedAt]));

  const due = publications.filter((pub) => {
    const last = lastFetched.get(`${pub.socialPostId}:${pub.platform}`) ?? null;
    const ok = opts.force || isMetricDue(pub.platform, pub.publishedAt ?? now, last, now);
    if (!ok) summary.skippedNotDue++;
    return ok;
  });
  // Nunca coletados primeiro; depois os mais recentes (orderBy acima).
  due.sort((a, b) => Number(lastFetched.has(`${a.socialPostId}:${a.platform}`)) - Number(lastFetched.has(`${b.socialPostId}:${b.platform}`)));
  const batch = due.slice(0, MAX_POSTS_PER_RUN);
  summary.deferred = due.length - batch.length;

  for (const pub of batch) {
    summary.checked++;
    const cred = creds[pub.platform === "FACEBOOK" ? "FACEBOOK" : "INSTAGRAM"];
    const externalId = pub.externalId!;
    let result: PostMetricResult;
    if ("error" in cred) result = { ok: false, error: cred.error };
    else if (pub.platform === "FACEBOOK") result = await fetchFacebookPostMetrics(externalId, cred.token);
    else result = await fetchInstagramMediaMetrics(externalId, cred.token, pub.platform === "INSTAGRAM_STORY" ? "STORY" : "FEED");

    await saveMetric(pub.socialPostId, pub.platform, externalId, result, now);
    if (result.ok) summary.updated++;
    else {
      summary.failed++;
      summary.errors.push({ postId: pub.socialPostId, platform: pub.platform, error: result.error });
    }
  }

  return summary;
}

async function saveMetric(socialPostId: string, platform: SocialPlatform, externalId: string, result: PostMetricResult, now: Date) {
  const where = { socialPostId_platform: { socialPostId, platform } };
  if (!result.ok) {
    // Mantém os últimos números bons; só registra o erro (fetchedAt avança para não martelar a API).
    await prisma.socialPostMetric.upsert({
      where,
      create: { socialPostId, platform, externalId, error: result.error, fetchedAt: now },
      update: { externalId, error: result.error, fetchedAt: now },
    });
    return;
  }
  const { raw, ...values } = result.values;
  const data = { externalId, ...values, raw: raw as Prisma.InputJsonValue, error: null, fetchedAt: now };
  await prisma.socialPostMetric.upsert({ where, create: { socialPostId, platform, ...data }, update: data });
}

async function collectAccountSnapshots(creds: Record<"FACEBOOK" | "INSTAGRAM", Credentials>, now: Date, summary: CollectSummary) {
  const date = saoPauloDate(now);
  for (const platform of ["INSTAGRAM", "FACEBOOK"] as const) {
    const cred = creds[platform];
    let result: AccountSnapshotResult;
    if ("error" in cred) result = { ok: false, error: cred.error };
    else if (platform === "INSTAGRAM") result = await fetchInstagramAccountSnapshot(cred.accountId, cred.token, now);
    else result = await fetchFacebookPageSnapshot(cred.accountId, cred.token);

    const where = { platform_date: { platform, date } };
    if (result.ok) {
      const { raw, ...values } = result.values;
      const data = { ...values, raw: raw as Prisma.InputJsonValue, error: null, fetchedAt: now };
      await prisma.socialAccountSnapshot.upsert({ where, create: { platform, date, ...data }, update: data });
      summary.accounts.push({ platform, ok: true });
    } else {
      await prisma.socialAccountSnapshot.upsert({
        where,
        create: { platform, date, error: result.error, fetchedAt: now },
        update: { error: result.error, fetchedAt: now },
      });
      summary.accounts.push({ platform, ok: false, error: result.error });
    }
  }
}
