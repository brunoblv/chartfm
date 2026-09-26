import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/social/publish/shared", () => ({ timedFetch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { timedFetch } from "@/lib/social/publish/shared";
import { fetchInsightsResilient, parseInsightsResponse } from "@/lib/social/metrics/graph";
import { fetchInstagramMediaMetrics } from "@/lib/social/metrics/instagram";
import { fetchFacebookPostMetrics } from "@/lib/social/metrics/facebook";
import { isMetricDue, saoPauloDate } from "@/lib/social/metrics/collector";
import { computeTotals, engagementRate, postsToCsv, type SocialPostMetricRow } from "@/lib/social/metrics/dashboard";

const ok = (json: unknown) => ({ ok: true, status: 200, json });
const fail = (code: number, message: string, status = 400) => ({ ok: false, status, json: { error: { code, message } } });

function metricFromUrl(url: string): string[] {
  return new URL(url).searchParams.get("metric")?.split(",") ?? [];
}

describe("parseInsightsResponse", () => {
  it("lê values[] (último valor) e total_value, e soma breakdowns", () => {
    const parsed = parseInsightsResponse({
      data: [
        { name: "reach", values: [{ value: 10 }, { value: 42 }] },
        { name: "views", total_value: { value: 99 } },
        { name: "post_reactions_by_type_total", values: [{ value: { like: 3, love: 2 } }] },
        { name: "broken", values: [{ value: "x" }] },
      ],
    });
    expect(parsed).toEqual({ reach: 42, views: 99, post_reactions_by_type_total: 5 });
  });

  it("aceita resposta vazia/inválida", () => {
    expect(parseInsightsResponse(null)).toEqual({});
    expect(parseInsightsResponse({ data: "nope" })).toEqual({});
  });
});

describe("fetchInsightsResilient", () => {
  beforeEach(() => {
    vi.mocked(timedFetch).mockReset();
  });

  it("cai para métrica a métrica quando uma está descontinuada (#100)", async () => {
    vi.mocked(timedFetch).mockImplementation(async (url: string) => {
      const metrics = metricFromUrl(url);
      if (metrics.includes("impressions")) return fail(100, "metric impressions is no longer supported") as any;
      return ok({ data: metrics.map((name) => ({ name, values: [{ value: name.length }] })) }) as any;
    });

    const res = await fetchInsightsResilient((m) => `https://x.test/insights?metric=${m.join(",")}`, ["reach", "impressions", "views"]);
    expect(res.error).toBeNull();
    expect(res.values).toEqual({ reach: 5, views: 5 });
    expect(res.unavailable).toEqual(["impressions"]);
  });

  it("não insiste métrica a métrica em erro de permissão", async () => {
    vi.mocked(timedFetch).mockResolvedValue(fail(10, "Application does not have permission for this action", 403) as any);
    const res = await fetchInsightsResilient((m) => `https://x.test/?metric=${m.join(",")}`, ["a", "b", "c"]);
    expect(res.error).toContain("permission");
    expect(timedFetch).toHaveBeenCalledTimes(1);
  });

  it("não vaza token na mensagem de erro", async () => {
    vi.mocked(timedFetch).mockResolvedValue(fail(190, "Invalid token IGAAabc123 access_token=IGAAsecret", 400) as any);
    const res = await fetchInsightsResilient(() => "https://x.test/", ["a"]);
    expect(res.error).not.toContain("IGAAabc123");
    expect(res.error).not.toContain("IGAAsecret");
  });
});

describe("fetchInstagramMediaMetrics", () => {
  beforeEach(() => {
    vi.mocked(timedFetch).mockReset();
  });

  it("combina campos da mídia com insights do Feed", async () => {
    vi.mocked(timedFetch).mockImplementation(async (url: string) => {
      if (url.includes("/insights")) {
        return ok({
          data: [
            { name: "reach", values: [{ value: 500 }] },
            { name: "views", values: [{ value: 800 }] },
            { name: "likes", values: [{ value: 40 }] },
            { name: "comments", values: [{ value: 5 }] },
            { name: "shares", values: [{ value: 3 }] },
            { name: "saved", values: [{ value: 7 }] },
          ],
        }) as any;
      }
      return ok({ like_count: 39, comments_count: 5, permalink: "https://instagram.com/p/abc" }) as any;
    });

    const res = await fetchInstagramMediaMetrics("123", "tok", "FEED");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values).toMatchObject({ likes: 40, comments: 5, shares: 3, saves: 7, reach: 500, views: 800, permalink: "https://instagram.com/p/abc" });
  });

  it("retorna erro quando a mídia não existe mais", async () => {
    vi.mocked(timedFetch).mockResolvedValue(fail(100, "Object with ID '123' does not exist") as any);
    const res = await fetchInstagramMediaMetrics("123", "tok", "STORY");
    expect(res).toEqual({ ok: false, error: "Object with ID '123' does not exist" });
  });
});

describe("fetchFacebookPostMetrics", () => {
  beforeEach(() => {
    vi.mocked(timedFetch).mockReset();
  });

  it("usa reactions/comments/shares do post e prefere as métricas novas de views", async () => {
    vi.mocked(timedFetch).mockImplementation(async (url: string) => {
      if (url.includes("/insights")) {
        const metrics = metricFromUrl(url);
        if (metrics.includes("post_impressions")) return fail(100, "The value must be a valid insights metric") as any;
        return ok({ data: metrics.map((name) => ({ name, values: [{ value: name === "post_media_view" ? 900 : name === "post_total_media_view_unique" ? 600 : 12 }] })) }) as any;
      }
      return ok({
        permalink_url: "https://facebook.com/1_2",
        shares: { count: 4 },
        reactions: { summary: { total_count: 20 } },
        comments: { summary: { total_count: 6 } },
      }) as any;
    });

    const res = await fetchFacebookPostMetrics("1_2", "tok");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values).toMatchObject({ likes: 20, comments: 6, shares: 4, reach: 600, views: 900, clicks: 12, impressions: null });
    expect(res.values.raw.unavailable).toContain("post_impressions");
  });
});

describe("isMetricDue", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it("sempre coleta o que nunca foi coletado", () => {
    expect(isMetricDue("FACEBOOK", hoursAgo(24 * 30), null, now)).toBe(true);
  });

  it("frequência cai com a idade do post", () => {
    expect(isMetricDue("INSTAGRAM_FEED", hoursAgo(10), hoursAgo(1), now)).toBe(true);
    expect(isMetricDue("INSTAGRAM_FEED", hoursAgo(10), hoursAgo(0.5), now)).toBe(false);
    expect(isMetricDue("INSTAGRAM_FEED", hoursAgo(72), hoursAgo(3), now)).toBe(false);
    expect(isMetricDue("INSTAGRAM_FEED", hoursAgo(72), hoursAgo(6), now)).toBe(true);
    expect(isMetricDue("FACEBOOK", hoursAgo(24 * 20), hoursAgo(12), now)).toBe(false);
    expect(isMetricDue("FACEBOOK", hoursAgo(24 * 20), hoursAgo(24), now)).toBe(true);
    expect(isMetricDue("FACEBOOK", hoursAgo(24 * 61), hoursAgo(48), now)).toBe(false);
  });

  it("story só enquanto está no ar", () => {
    expect(isMetricDue("INSTAGRAM_STORY", hoursAgo(5), hoursAgo(1), now)).toBe(true);
    expect(isMetricDue("INSTAGRAM_STORY", hoursAgo(30), hoursAgo(5), now)).toBe(false);
  });
});

describe("saoPauloDate", () => {
  it("usa o dia de São Paulo (UTC-3)", () => {
    expect(saoPauloDate(new Date("2026-09-26T02:00:00Z")).toISOString()).toBe("2026-09-25T00:00:00.000Z");
    expect(saoPauloDate(new Date("2026-09-26T04:00:00Z")).toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });
});

describe("dashboard helpers", () => {
  const row = (over: Partial<SocialPostMetricRow>): SocialPostMetricRow => ({
    postId: "p1",
    eventType: "GLOBAL100_PUBLISHED",
    platform: "INSTAGRAM_FEED",
    publishedAt: "2026-09-20T12:00:00.000Z",
    caption: null,
    permalink: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    impressions: null,
    views: null,
    clicks: null,
    engagementRate: null,
    fetchedAt: null,
    error: null,
    ...over,
  });

  it("engagementRate = interações ÷ alcance", () => {
    expect(engagementRate({ likes: 40, comments: 5, shares: 3, saves: 2, reach: 500 })).toBe(10);
    expect(engagementRate({ likes: 40, comments: 5, shares: 3, saves: 2, reach: 0 })).toBeNull();
  });

  it("computeTotals agrega por plataforma", () => {
    const totals = computeTotals([
      row({ likes: 10, reach: 100, engagementRate: 10, fetchedAt: "x" }),
      row({ postId: "p2", likes: 5, reach: 50, engagementRate: 20, fetchedAt: "x" }),
      row({ postId: "p3", platform: "FACEBOOK", error: "boom", fetchedAt: "x" }),
    ]);
    const ig = totals.find((t) => t.platform === "INSTAGRAM_FEED")!;
    expect(ig).toMatchObject({ posts: 2, withData: 2, likes: 15, reach: 150, avgEngagementRate: 15 });
    expect(totals.find((t) => t.platform === "FACEBOOK")).toMatchObject({ posts: 1, withData: 0 });
  });

  it("CSV escapa legendas e neutraliza fórmulas", () => {
    const csv = postsToCsv([row({ caption: '=HYPERLINK("x"), "top"', likes: 3 })]);
    expect(csv.startsWith("﻿publishedAt,platform")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x""), ""top"""`);
  });
});
