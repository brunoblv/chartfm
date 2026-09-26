import { timedFetch } from "@/lib/social/publish/shared";
import { buildUrl, fetchInsightsResilient, graphErrorMessage } from "@/lib/social/metrics/graph";
import { firstNum, numOrNull, type AccountSnapshotResult, type PostMetricResult } from "@/lib/social/metrics/types";

// Mesmo host/versão da publicação (Instagram API with Instagram Login, token "IGAA...").
const GRAPH_BASE = "https://graph.instagram.com/v21.0";

// "impressions" foi descontinuada para mídias novas (substituída por "views"); fica na lista
// porque ainda responde para posts antigos — se falhar, cai em `unavailable` e segue.
const FEED_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions", "impressions"];
const STORY_METRICS = ["reach", "views", "replies", "shares", "total_interactions", "profile_visits", "follows"];
const ACCOUNT_METRICS = ["reach", "views", "profile_views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "follows_and_unfollows"];

export async function fetchInstagramMediaMetrics(mediaId: string, token: string, target: "FEED" | "STORY"): Promise<PostMetricResult> {
  const fields = target === "FEED" ? "like_count,comments_count,permalink,media_type,media_product_type,timestamp" : "permalink,media_type,media_product_type,timestamp";
  const media = await timedFetch(buildUrl(GRAPH_BASE, mediaId, { fields, access_token: token }));
  if (!media.ok) return { ok: false, error: graphErrorMessage(media) };

  const metrics = target === "FEED" ? FEED_METRICS : STORY_METRICS;
  const insights = await fetchInsightsResilient(
    (m) => buildUrl(GRAPH_BASE, `${mediaId}/insights`, { metric: m.join(","), access_token: token }),
    metrics,
  );
  const iv = insights.values;
  const m = media.json ?? {};

  return {
    ok: true,
    values: {
      likes: target === "FEED" ? firstNum(iv.likes, m.like_count) : null,
      // Story não tem comentários; "replies" (respostas por DM) é o equivalente.
      comments: target === "FEED" ? firstNum(iv.comments, m.comments_count) : numOrNull(iv.replies),
      shares: numOrNull(iv.shares),
      saves: numOrNull(iv.saved),
      reach: numOrNull(iv.reach),
      impressions: numOrNull(iv.impressions),
      views: numOrNull(iv.views),
      clicks: numOrNull(iv.profile_visits),
      permalink: typeof m.permalink === "string" ? m.permalink : null,
      raw: {
        media: m,
        insights: iv,
        unavailable: insights.unavailable,
        insightsError: insights.error,
      },
    },
  };
}

function yesterdayRange(now: Date): { since: string; until: string } {
  const until = Math.floor(now.getTime() / 1000);
  return { since: String(until - 24 * 60 * 60), until: String(until) };
}

export async function fetchInstagramAccountSnapshot(igUserId: string, token: string, now = new Date()): Promise<AccountSnapshotResult> {
  const profile = await timedFetch(
    buildUrl(GRAPH_BASE, igUserId, { fields: "username,followers_count,follows_count,media_count", access_token: token }),
  );
  if (!profile.ok) return { ok: false, error: graphErrorMessage(profile) };

  const range = yesterdayRange(now);
  const insights = await fetchInsightsResilient(
    (m) =>
      buildUrl(GRAPH_BASE, `${igUserId}/insights`, {
        metric: m.join(","),
        period: "day",
        metric_type: "total_value",
        ...range,
        access_token: token,
      }),
    ACCOUNT_METRICS,
  );
  const iv = insights.values;
  const p = profile.json ?? {};

  return {
    ok: true,
    values: {
      followers: numOrNull(p.followers_count),
      follows: numOrNull(p.follows_count),
      mediaCount: numOrNull(p.media_count),
      reach: numOrNull(iv.reach),
      views: numOrNull(iv.views),
      profileViews: numOrNull(iv.profile_views),
      accountsEngaged: numOrNull(iv.accounts_engaged),
      interactions: numOrNull(iv.total_interactions),
      raw: {
        username: p.username ?? null,
        insightsLast24h: iv,
        unavailable: insights.unavailable,
        insightsError: insights.error,
      },
    },
  };
}
