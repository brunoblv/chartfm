import { timedFetch } from "@/lib/social/publish/shared";
import { buildUrl, fetchInsightsResilient, graphErrorMessage } from "@/lib/social/metrics/graph";
import { firstNum, numOrNull, type AccountSnapshotResult, type PostMetricResult } from "@/lib/social/metrics/types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

// A Meta trocou post_impressions* por post_media_view/post_total_media_view_unique (2025).
// Pedimos as duas gerações: o que a versão/página não suportar cai em `unavailable`.
const POST_METRICS = [
  "post_media_view",
  "post_total_media_view_unique",
  "post_impressions",
  "post_impressions_unique",
  "post_clicks",
  "post_reactions_by_type_total",
];
const PAGE_METRICS = [
  "page_media_view",
  "page_total_media_view_unique",
  "page_impressions",
  "page_impressions_unique",
  "page_post_engagements",
  "page_views_total",
  "page_daily_follows_unique",
];

/**
 * postId é o `post_id` retornado por /{page}/photos ("{pageId}_{postId}"). Exige token de
 * Página com pages_read_engagement + read_insights — sem isso a API responde erro #10/#200.
 */
export async function fetchFacebookPostMetrics(postId: string, token: string): Promise<PostMetricResult> {
  const post = await timedFetch(
    buildUrl(GRAPH_BASE, postId, {
      fields: "permalink_url,created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
      access_token: token,
    }),
  );
  if (!post.ok) return { ok: false, error: graphErrorMessage(post) };

  const insights = await fetchInsightsResilient(
    (m) => buildUrl(GRAPH_BASE, `${postId}/insights`, { metric: m.join(","), access_token: token }),
    POST_METRICS,
  );
  const iv = insights.values;
  const p = post.json ?? {};

  return {
    ok: true,
    values: {
      likes: firstNum(p.reactions?.summary?.total_count, iv.post_reactions_by_type_total),
      comments: numOrNull(p.comments?.summary?.total_count),
      shares: numOrNull(p.shares?.count) ?? 0,
      saves: null,
      reach: firstNum(iv.post_total_media_view_unique, iv.post_impressions_unique),
      impressions: numOrNull(iv.post_impressions),
      views: numOrNull(iv.post_media_view),
      clicks: numOrNull(iv.post_clicks),
      permalink: typeof p.permalink_url === "string" ? p.permalink_url : null,
      raw: {
        createdTime: p.created_time ?? null,
        insights: iv,
        unavailable: insights.unavailable,
        insightsError: insights.error,
      },
    },
  };
}

export async function fetchFacebookPageSnapshot(pageId: string, token: string): Promise<AccountSnapshotResult> {
  const page = await timedFetch(buildUrl(GRAPH_BASE, pageId, { fields: "name,followers_count,fan_count", access_token: token }));
  if (!page.ok) return { ok: false, error: graphErrorMessage(page) };

  const insights = await fetchInsightsResilient(
    (m) => buildUrl(GRAPH_BASE, `${pageId}/insights`, { metric: m.join(","), period: "day", access_token: token }),
    PAGE_METRICS,
  );
  const iv = insights.values;
  const p = page.json ?? {};

  return {
    ok: true,
    values: {
      followers: firstNum(p.followers_count, p.fan_count),
      follows: null,
      mediaCount: null,
      reach: firstNum(iv.page_total_media_view_unique, iv.page_impressions_unique),
      views: firstNum(iv.page_media_view, iv.page_impressions),
      profileViews: numOrNull(iv.page_views_total),
      accountsEngaged: null,
      interactions: numOrNull(iv.page_post_engagements),
      raw: {
        name: p.name ?? null,
        fanCount: p.fan_count ?? null,
        insightsLastDay: iv,
        unavailable: insights.unavailable,
        insightsError: insights.error,
      },
    },
  };
}
