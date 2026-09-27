import { prisma } from "@/lib/prisma";
import { resolveSocialAccessToken, resolveSocialAccountId } from "@/lib/social/credentials/token-resolver";
import { timedFetch } from "@/lib/social/publish/shared";
import {
  addDays,
  buildFollowerSeries,
  chunkRange,
  computeVelocity,
  dayRange,
  insightEndTimeToDay,
  isoDay,
  mediaKind,
  ratePct,
  sumBreakdown,
  type FollowerDayPoint,
  type FollowerVelocity,
  type IgMediaKind,
  type IgRangeDays,
} from "./compute";

// Instagram API with Instagram Login — mesma credencial usada na publicação.
const GRAPH_BASE = "https://graph.instagram.com/v23.0";
const MAX_POSTS = 60;
const MEDIA_INSIGHT_CONCURRENCY = 6;
const MEDIA_METRICS_FULL = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"];
// Posts antigos às vezes recusam "views"; cai para o conjunto mínimo em vez de perder o post.
const MEDIA_METRICS_FALLBACK = ["reach", "likes", "comments", "shares", "saved", "total_interactions"];

export type IgPostRow = {
  id: string;
  caption: string;
  kind: IgMediaKind;
  timestamp: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number | null;
  engagementRatePct: number | null;
  shareRatePct: number | null;
};

export type InstagramAnalytics = {
  configured: boolean;
  rangeDays: IgRangeDays;
  username: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  followerSeries: FollowerDayPoint[];
  velocity: FollowerVelocity | null;
  follows: number | null;
  unfollows: number | null;
  contactTaps: { type: string; value: number }[] | null;
  posts: IgPostRow[];
  errors: { section: "account" | "followers" | "follows" | "contact" | "posts"; message: string }[];
  fetchedAt: string;
};

type Creds = { token: string; igUserId: string };

async function resolveCreds(): Promise<Creds | null> {
  const [token, igUserId] = await Promise.all([resolveSocialAccessToken("INSTAGRAM"), resolveSocialAccountId("INSTAGRAM")]);
  return token && igUserId ? { token, igUserId } : null;
}

async function graphGet(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await timedFetch(`${GRAPH_BASE}/${path}?${qs.toString()}`);
  if (!res.ok) {
    const message = res.json?.error?.message ?? ("error" in res ? res.error : null) ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return res.json;
}

function toUnix(day: string, endOfDay = false): string {
  const t = new Date(`${day}T00:00:00Z`).getTime() / 1000 + (endOfDay ? 86400 : 0);
  return String(Math.floor(t));
}

/** Saldo diário (follower_count, period=day). A API só serve os últimos ~30 dias. */
async function fetchDailyNet(creds: Creds, from: string, to: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const { since, until } of chunkRange(from, to, 30)) {
    const json = await graphGet(
      `${creds.igUserId}/insights`,
      { metric: "follower_count", period: "day", since: toUnix(since), until: toUnix(until, true) },
      creds.token,
    );
    for (const metric of json?.data ?? []) {
      for (const v of metric?.values ?? []) {
        if (typeof v?.end_time === "string" && typeof v?.value === "number") out.set(insightEndTimeToDay(v.end_time), v.value);
      }
    }
  }
  return out;
}

async function fetchBreakdownTotals(creds: Creds, metric: string, breakdown: string, from: string, to: string) {
  const payloads = [];
  for (const { since, until } of chunkRange(from, to, 30)) {
    payloads.push(
      await graphGet(
        `${creds.igUserId}/insights`,
        { metric, period: "day", metric_type: "total_value", breakdown, since: toUnix(since), until: toUnix(until, true) },
        creds.token,
      ),
    );
  }
  return sumBreakdown(payloads);
}

async function fetchMediaInsights(mediaId: string, token: string): Promise<Record<string, number>> {
  let json: any;
  try {
    json = await graphGet(`${mediaId}/insights`, { metric: MEDIA_METRICS_FULL.join(",") }, token);
  } catch {
    json = await graphGet(`${mediaId}/insights`, { metric: MEDIA_METRICS_FALLBACK.join(",") }, token);
  }
  const out: Record<string, number> = {};
  for (const m of json?.data ?? []) {
    const value = m?.values?.[0]?.value ?? m?.total_value?.value;
    if (typeof value === "number") out[m.name] = value;
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function fetchPosts(creds: Creds, from: string): Promise<IgPostRow[]> {
  const media: any[] = [];
  let url: string | null = null;
  let json = await graphGet(
    `${creds.igUserId}/media`,
    {
      fields: "id,caption,media_type,media_product_type,timestamp,thumbnail_url,media_url,permalink,like_count,comments_count",
      limit: "50",
    },
    creds.token,
  );
  const sinceMs = new Date(`${from}T00:00:00Z`).getTime();
  // Paginação até sair do range ou bater o teto de posts.
  for (;;) {
    let reachedOlder = false;
    for (const m of json?.data ?? []) {
      if (new Date(m.timestamp).getTime() < sinceMs) {
        reachedOlder = true;
        break;
      }
      media.push(m);
    }
    url = json?.paging?.next ?? null;
    if (reachedOlder || !url || media.length >= MAX_POSTS) break;
    const res = await timedFetch(url);
    if (!res.ok) break;
    json = res.json;
  }

  const rows = await mapLimit(media.slice(0, MAX_POSTS), MEDIA_INSIGHT_CONCURRENCY, async (m): Promise<IgPostRow> => {
    const ins = await fetchMediaInsights(m.id, creds.token).catch(() => ({}) as Record<string, number>);
    const likes = ins.likes ?? m.like_count ?? null;
    const comments = ins.comments ?? m.comments_count ?? null;
    const reach = ins.reach ?? null;
    const interactions = ins.total_interactions ?? null;
    return {
      id: m.id,
      caption: (m.caption ?? "").split("\n")[0].slice(0, 140),
      kind: mediaKind(m.media_type, m.media_product_type),
      timestamp: m.timestamp,
      thumbnailUrl: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : m.media_url) ?? null,
      permalink: m.permalink ?? null,
      reach,
      views: ins.views ?? null,
      likes,
      comments,
      shares: ins.shares ?? null,
      saves: ins.saved ?? null,
      interactions,
      engagementRatePct: ratePct(interactions, reach),
      shareRatePct: ratePct(ins.shares, reach),
    };
  });
  return rows;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function dbDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Grava o saldo diário (e opcionalmente o total de hoje) para montar histórico além dos 30 dias da API. */
async function persistFollowerDays(netByDay: Map<string, number>, today: string, followersCount: number | null) {
  const ops = [...netByDay].map(([day, net]) =>
    prisma.instagramFollowerDay.upsert({
      where: { date: dbDay(day) },
      create: { date: dbDay(day), netFollowers: net },
      update: { netFollowers: net },
    }),
  );
  if (followersCount != null) {
    ops.push(
      prisma.instagramFollowerDay.upsert({
        where: { date: dbDay(today) },
        create: { date: dbDay(today), followersCount },
        update: { followersCount },
      }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

/** Coleta diária (cron): atualiza os últimos 30 dias de saldo e o total atual. */
export async function syncInstagramFollowerDays(): Promise<{ ok: boolean; days: number; error?: string }> {
  const creds = await resolveCreds();
  if (!creds) return { ok: false, days: 0, error: "Instagram não configurado" };
  const today = isoDay(new Date());
  try {
    const account = await graphGet(creds.igUserId, { fields: "followers_count" }, creds.token);
    const net = await fetchDailyNet(creds, addDays(today, -29), addDays(today, -1));
    await persistFollowerDays(net, today, typeof account?.followers_count === "number" ? account.followers_count : null);
    return { ok: true, days: net.size };
  } catch (err) {
    return { ok: false, days: 0, error: errMessage(err) };
  }
}

export async function getInstagramAnalytics(rangeDays: IgRangeDays): Promise<InstagramAnalytics> {
  const today = isoDay(new Date());
  const to = addDays(today, -1);
  const from = addDays(today, -rangeDays);
  const base: InstagramAnalytics = {
    configured: false,
    rangeDays,
    username: null,
    profilePictureUrl: null,
    followersCount: null,
    mediaCount: null,
    followerSeries: [],
    velocity: null,
    follows: null,
    unfollows: null,
    contactTaps: null,
    posts: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  const creds = await resolveCreds();
  if (!creds) return base;
  base.configured = true;

  const errors = base.errors;
  // A API só tem os últimos 30 dias de follower_count; o resto vem do histórico salvo.
  const apiFrom = from > addDays(today, -29) ? from : addDays(today, -29);

  const [accountRes, netRes, followsRes, contactRes, postsRes, storedRes] = await Promise.allSettled([
    graphGet(creds.igUserId, { fields: "username,followers_count,media_count,profile_picture_url" }, creds.token),
    fetchDailyNet(creds, apiFrom, to),
    fetchBreakdownTotals(creds, "follows_and_unfollows", "follow_type", from, to),
    fetchBreakdownTotals(creds, "profile_links_taps", "contact_button_type", from, to),
    fetchPosts(creds, from),
    prisma.instagramFollowerDay.findMany({ where: { date: { gte: dbDay(from) } } }),
  ]);

  if (accountRes.status === "fulfilled") {
    const a = accountRes.value;
    base.username = a?.username ?? null;
    base.profilePictureUrl = a?.profile_picture_url ?? null;
    base.followersCount = typeof a?.followers_count === "number" ? a.followers_count : null;
    base.mediaCount = typeof a?.media_count === "number" ? a.media_count : null;
  } else errors.push({ section: "account", message: errMessage(accountRes.reason) });

  const netByDay = new Map<string, number>();
  const snapshotByDay = new Map<string, number>();
  if (storedRes.status === "fulfilled") {
    for (const row of storedRes.value) {
      const day = isoDay(row.date);
      if (row.netFollowers != null) netByDay.set(day, row.netFollowers);
      if (row.followersCount != null) snapshotByDay.set(day, row.followersCount);
    }
  }
  if (netRes.status === "fulfilled") {
    for (const [d, v] of netRes.value) netByDay.set(d, v);
    await persistFollowerDays(netRes.value, today, base.followersCount).catch((err) =>
      console.error("[instagram-analytics] falha ao salvar histórico", err),
    );
  } else errors.push({ section: "followers", message: errMessage(netRes.reason) });

  if (base.followersCount != null) {
    base.followerSeries = buildFollowerSeries(dayRange(from, to), netByDay, base.followersCount, snapshotByDay);
    base.velocity = computeVelocity(base.followerSeries);
  }

  if (followsRes.status === "fulfilled") {
    base.follows = followsRes.value.get("FOLLOWER") ?? 0;
    base.unfollows = followsRes.value.get("NON_FOLLOWER") ?? 0;
  } else errors.push({ section: "follows", message: errMessage(followsRes.reason) });

  if (contactRes.status === "fulfilled") {
    base.contactTaps = [...contactRes.value]
      .map(([type, value]) => ({ type, value }))
      .filter((t) => t.value > 0)
      .sort((a, b) => b.value - a.value);
  } else errors.push({ section: "contact", message: errMessage(contactRes.reason) });

  if (postsRes.status === "fulfilled") base.posts = postsRes.value;
  else errors.push({ section: "posts", message: errMessage(postsRes.reason) });

  return base;
}
