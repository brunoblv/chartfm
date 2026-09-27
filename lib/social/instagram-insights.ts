import { prisma } from "@/lib/prisma";
import { resolveSocialAccessToken, resolveSocialAccountId } from "@/lib/social/credentials/token-resolver";
import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import { timedFetch } from "@/lib/social/publish/shared";
import type { DailyValue, IgMediaKind, IgMediaRow } from "@/lib/social/instagram-analytics";

// Métricas como views/skip rate só existem em versões mais novas da API do que a usada na publicação.
const GRAPH_BASE = "https://graph.instagram.com/v23.0";
const DAY_MS = 86_400_000;
const CACHE_TTL_MS = 15 * 60_000;
const MEDIA_INSIGHTS_CONCURRENCY = 6;
const MAX_MEDIA = 150;

export const IG_RANGES = [7, 14, 30, 90] as const;
export type IgRange = (typeof IG_RANGES)[number];

export class InstagramApiError extends Error {}

export type IgBreakdownItem = { key: string; value: number };

export type InstagramDashboard = {
  account: { username: string | null; name: string | null; profilePictureUrl: string | null; followers: number; mediaCount: number };
  range: IgRange;
  since: string;
  until: string;
  fetchedAt: string;
  growth: {
    dailyNet: DailyValue[];
    follows: number | null;
    unfollows: number | null;
    reach: number | null;
    views: number | null;
    profileViews: number | null;
    accountsEngaged: number | null;
    totalInteractions: number | null;
    contactTaps: IgBreakdownItem[] | null;
  };
  media: IgMediaRow[];
  audience: {
    age: IgBreakdownItem[] | null;
    gender: IgBreakdownItem[] | null;
    city: IgBreakdownItem[] | null;
    country: IgBreakdownItem[] | null;
  };
  onlineFollowers: Record<string, number>[] | null;
  /** Erros parciais (métrica indisponível, conta pequena demais etc.) — o resto do painel continua. */
  warnings: string[];
};

async function igGet(path: string, params: Record<string, string | number>, token: string): Promise<any> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), access_token: token });
  const res = await timedFetch(`${GRAPH_BASE}/${path}?${qs.toString()}`);
  if (!res.ok) {
    const message = res.json?.error?.message ?? ("error" in res ? res.error : `HTTP ${res.status}`);
    throw new InstagramApiError(sanitizeErrorMessage(message));
  }
  return res.json;
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Converte uma falha de métrica em aviso em vez de derrubar o painel inteiro. */
async function soft<T>(label: string, warnings: string[], fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    warnings.push(`${label}: ${sanitizeErrorMessage(err)}`);
    return null;
  }
}

/** A API limita janelas de insights a 30 dias — quebra o período em pedaços. */
function windows(since: Date, until: Date): [Date, Date][] {
  const out: [Date, Date][] = [];
  let start = since;
  while (start < until) {
    const end = new Date(Math.min(until.getTime(), start.getTime() + 30 * DAY_MS));
    out.push([start, end]);
    start = end;
  }
  return out;
}

async function fetchDailyFollowerNet(igUserId: string, token: string, since: Date, until: Date): Promise<DailyValue[]> {
  const out: DailyValue[] = [];
  for (const [s, u] of windows(since, until)) {
    const json = await igGet(`${igUserId}/insights`, { metric: "follower_count", period: "day", since: unix(s), until: unix(u) }, token);
    for (const v of json?.data?.[0]?.values ?? []) {
      // end_time marca o fim do dia — o valor pertence ao dia anterior.
      out.push({ date: isoDay(new Date(new Date(v.end_time).getTime() - DAY_MS)), value: Number(v.value) || 0 });
    }
  }
  return out;
}

async function fetchTotalValue(
  igUserId: string,
  token: string,
  metric: string,
  since: Date,
  until: Date,
  breakdown?: string,
): Promise<{ total: number; breakdown: IgBreakdownItem[] }> {
  let total = 0;
  const acc = new Map<string, number>();
  for (const [s, u] of windows(since, until)) {
    const params: Record<string, string | number> = { metric, period: "day", metric_type: "total_value", since: unix(s), until: unix(u) };
    if (breakdown) params.breakdown = breakdown;
    const json = await igGet(`${igUserId}/insights`, params, token);
    const tv = json?.data?.[0]?.total_value;
    total += Number(tv?.value) || 0;
    for (const b of tv?.breakdowns ?? []) {
      for (const r of b.results ?? []) {
        const key = (r.dimension_values ?? []).join(" · ") || "—";
        acc.set(key, (acc.get(key) ?? 0) + (Number(r.value) || 0));
      }
    }
  }
  return { total, breakdown: [...acc.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value) };
}

async function fetchDemographic(igUserId: string, token: string, breakdown: string): Promise<IgBreakdownItem[]> {
  const json = await igGet(
    `${igUserId}/insights`,
    { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", timeframe: "this_month", breakdown },
    token,
  );
  const results = json?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  return results
    .map((r: any) => ({ key: (r.dimension_values ?? []).join(" · "), value: Number(r.value) || 0 }))
    .sort((a: IgBreakdownItem, b: IgBreakdownItem) => b.value - a.value);
}

async function fetchOnlineFollowers(igUserId: string, token: string): Promise<Record<string, number>[]> {
  const until = new Date();
  const since = new Date(until.getTime() - 30 * DAY_MS);
  const json = await igGet(`${igUserId}/insights`, { metric: "online_followers", period: "lifetime", since: unix(since), until: unix(until) }, token);
  return (json?.data?.[0]?.values ?? []).map((v: any) => v.value ?? {}).filter((v: object) => Object.keys(v).length > 0);
}

type RawMedia = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  timestamp: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
};

async function fetchMediaSince(igUserId: string, token: string, since: Date): Promise<RawMedia[]> {
  const out: RawMedia[] = [];
  let after: string | undefined;
  while (out.length < MAX_MEDIA) {
    const params: Record<string, string | number> = {
      fields: "id,caption,media_type,media_product_type,timestamp,permalink,media_url,thumbnail_url,like_count,comments_count",
      limit: 50,
    };
    if (after) params.after = after;
    const json = await igGet(`${igUserId}/media`, params, token);
    const page: RawMedia[] = json?.data ?? [];
    for (const m of page) {
      if (new Date(m.timestamp) < since) return out;
      // Stories não têm insights duráveis e somem em 24h.
      if (m.media_product_type === "STORY") continue;
      out.push(m);
    }
    after = json?.paging?.cursors?.after;
    if (!after || !json?.paging?.next || page.length === 0) break;
  }
  return out;
}

function mediaKind(m: RawMedia): IgMediaKind {
  if (m.media_product_type === "REELS") return "REEL";
  if (m.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (m.media_type === "VIDEO") return "VIDEO";
  return "IMAGE";
}

const BASE_METRICS = ["reach", "likes", "comments", "shares", "saved", "total_interactions"];
const METRICS_BY_KIND: Record<IgMediaKind, string[][]> = {
  // Cada lista é uma tentativa: se a API recusar uma métrica, cai para a próxima mais conservadora.
  REEL: [
    [...BASE_METRICS, "views", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "reels_skip_rate"],
    [...BASE_METRICS, "views", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"],
    BASE_METRICS,
  ],
  IMAGE: [[...BASE_METRICS, "views", "follows", "profile_visits"], [...BASE_METRICS, "views"], BASE_METRICS],
  CAROUSEL: [[...BASE_METRICS, "views", "follows", "profile_visits"], [...BASE_METRICS, "views"], BASE_METRICS],
  VIDEO: [[...BASE_METRICS, "views"], BASE_METRICS],
};

async function fetchMediaRow(m: RawMedia, token: string): Promise<IgMediaRow> {
  const kind = mediaKind(m);
  let values: Record<string, number> = {};
  for (const metrics of METRICS_BY_KIND[kind]) {
    try {
      const json = await igGet(`${m.id}/insights`, { metric: metrics.join(",") }, token);
      values = Object.fromEntries((json?.data ?? []).map((d: any) => [d.name, Number(d.values?.[0]?.value ?? d.total_value?.value) || 0]));
      break;
    } catch {
      // tenta o próximo conjunto de métricas
    }
  }
  const has = (k: string) => Object.prototype.hasOwnProperty.call(values, k);
  const likes = has("likes") ? values.likes : (m.like_count ?? 0);
  const comments = has("comments") ? values.comments : (m.comments_count ?? 0);
  return {
    id: m.id,
    kind,
    caption: m.caption ?? "",
    permalink: m.permalink ?? null,
    thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
    timestamp: m.timestamp,
    reach: values.reach ?? 0,
    views: values.views ?? 0,
    likes,
    comments,
    shares: values.shares ?? 0,
    saves: values.saved ?? 0,
    interactions: values.total_interactions ?? likes + comments + (values.shares ?? 0) + (values.saved ?? 0),
    follows: has("follows") ? values.follows : null,
    profileVisits: has("profile_visits") ? values.profile_visits : null,
    avgWatchTimeMs: has("ig_reels_avg_watch_time") ? values.ig_reels_avg_watch_time : null,
    totalWatchTimeMs: has("ig_reels_video_view_total_time") ? values.ig_reels_video_view_total_time : null,
    skipRate: has("reels_skip_rate") ? values.reels_skip_rate : null,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Guarda o saldo diário: a API só devolve 30 dias, então o histórico de 90 dias vem do banco. */
async function persistDailyNet(rows: DailyValue[]) {
  await Promise.all(
    rows.map((r) =>
      prisma.instagramDailyStat.upsert({
        where: { date: new Date(`${r.date}T00:00:00Z`) },
        create: { date: new Date(`${r.date}T00:00:00Z`), netFollowers: r.value },
        update: { netFollowers: r.value },
      }),
    ),
  );
}

async function loadDailyNet(since: Date, until: Date): Promise<DailyValue[]> {
  const rows = await prisma.instagramDailyStat.findMany({
    where: { date: { gte: new Date(`${isoDay(since)}T00:00:00Z`), lt: new Date(`${isoDay(until)}T00:00:00Z`) } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({ date: isoDay(r.date), value: r.netFollowers }));
}

async function buildDashboard(range: IgRange): Promise<InstagramDashboard> {
  const [token, igUserId] = await Promise.all([resolveSocialAccessToken("INSTAGRAM"), resolveSocialAccountId("INSTAGRAM")]);
  if (!token || !igUserId) throw new InstagramApiError("Instagram não configurado (token ou ID da conta ausente)");

  const warnings: string[] = [];
  const until = new Date();
  const since = new Date(until.getTime() - range * DAY_MS);
  // follower_count só aceita os últimos 30 dias, excluindo hoje.
  const followerSince = new Date(Math.max(since.getTime(), until.getTime() - 29 * DAY_MS));

  const account = await igGet(igUserId, { fields: "username,name,profile_picture_url,followers_count,media_count" }, token);

  const [dailyNetApi, followsUnfollows, reach, views, profileViews, accountsEngaged, totalInteractions, contactTaps, rawMedia, age, gender, city, country, online] =
    await Promise.all([
      soft("follower_count", warnings, () => fetchDailyFollowerNet(igUserId, token, followerSince, until)),
      soft("follows_and_unfollows", warnings, () => fetchTotalValue(igUserId, token, "follows_and_unfollows", since, until, "follow_type")),
      soft("reach", warnings, () => fetchTotalValue(igUserId, token, "reach", since, until)),
      soft("views", warnings, () => fetchTotalValue(igUserId, token, "views", since, until)),
      soft("profile_views", warnings, () => fetchTotalValue(igUserId, token, "profile_views", since, until)),
      soft("accounts_engaged", warnings, () => fetchTotalValue(igUserId, token, "accounts_engaged", since, until)),
      soft("total_interactions", warnings, () => fetchTotalValue(igUserId, token, "total_interactions", since, until)),
      soft("profile_links_taps", warnings, () => fetchTotalValue(igUserId, token, "profile_links_taps", since, until, "contact_button_type")),
      soft("media", warnings, () => fetchMediaSince(igUserId, token, since)),
      soft("follower_demographics (age)", warnings, () => fetchDemographic(igUserId, token, "age")),
      soft("follower_demographics (gender)", warnings, () => fetchDemographic(igUserId, token, "gender")),
      soft("follower_demographics (city)", warnings, () => fetchDemographic(igUserId, token, "city")),
      soft("follower_demographics (country)", warnings, () => fetchDemographic(igUserId, token, "country")),
      soft("online_followers", warnings, () => fetchOnlineFollowers(igUserId, token)),
    ]);

  let dailyNet = dailyNetApi ?? [];
  const persisted = await soft("snapshot", warnings, async () => {
    if (dailyNet.length) await persistDailyNet(dailyNet);
    return loadDailyNet(since, until);
  });
  if (persisted?.length) {
    // O banco tem o histórico além dos 30 dias; o que veio agora da API tem prioridade.
    const byDate = new Map(persisted.map((d) => [d.date, d.value]));
    for (const d of dailyNet) byDate.set(d.date, d.value);
    dailyNet = [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }

  const media = rawMedia ? await mapLimit(rawMedia, MEDIA_INSIGHTS_CONCURRENCY, (m) => fetchMediaRow(m, token)) : [];

  const fuBreakdown = followsUnfollows?.breakdown ?? [];
  return {
    account: {
      username: account?.username ?? null,
      name: account?.name ?? null,
      profilePictureUrl: account?.profile_picture_url ?? null,
      followers: Number(account?.followers_count) || 0,
      mediaCount: Number(account?.media_count) || 0,
    },
    range,
    since: since.toISOString(),
    until: until.toISOString(),
    fetchedAt: new Date().toISOString(),
    growth: {
      dailyNet,
      // follow_type: FOLLOWER = novos follows, NON_FOLLOWER = unfollows.
      follows: followsUnfollows ? (fuBreakdown.find((b) => b.key === "FOLLOWER")?.value ?? 0) : null,
      unfollows: followsUnfollows ? (fuBreakdown.find((b) => b.key === "NON_FOLLOWER")?.value ?? 0) : null,
      reach: reach?.total ?? null,
      views: views?.total ?? null,
      profileViews: profileViews?.total ?? null,
      accountsEngaged: accountsEngaged?.total ?? null,
      totalInteractions: totalInteractions?.total ?? null,
      contactTaps: contactTaps?.breakdown ?? null,
    },
    media,
    audience: { age, gender, city, country },
    onlineFollowers: online,
    warnings,
  };
}

const cache = new Map<IgRange, { at: number; data: InstagramDashboard }>();
const inflight = new Map<IgRange, Promise<InstagramDashboard>>();

/** Cache em memória: cada carga faz 1 chamada por post à API, e a Meta tem rate limit por conta. */
export async function getInstagramDashboard(range: IgRange, { refresh = false } = {}): Promise<InstagramDashboard> {
  const hit = cache.get(range);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const pending = inflight.get(range);
  if (pending) return pending;
  const promise = buildDashboard(range)
    .then((data) => {
      cache.set(range, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(range));
  inflight.set(range, promise);
  return promise;
}

export function parseIgRange(value: string | null | undefined): IgRange {
  const n = Number(value);
  return (IG_RANGES as readonly number[]).includes(n) ? (n as IgRange) : 30;
}
