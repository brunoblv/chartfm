import type { ReviewItem, TimelineItem } from "@/components/home/TimelineTabs";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import type { SystemFeedItem } from "@/lib/system-feed";
import type { EditorialPick } from "@/lib/editorial-picks-data";

export type HomeFeedItem =
  | { kind: "chart"; id: string; createdAt: string; item: TimelineItem }
  | { kind: "review"; id: string; createdAt: string; item: ReviewItem }
  | { kind: "recommendation"; id: string; createdAt: string; item: RecommendationItem }
  | { kind: "system"; id: string; createdAt: string; item: SystemFeedItem }
  | { kind: "editorial"; id: string; createdAt: string; item: EditorialPick };

export function mergeHomeFeed(
  charts: TimelineItem[],
  reviews: ReviewItem[],
  recommendations: RecommendationItem[],
  limit = 30,
  systemPosts: SystemFeedItem[] = [],
  editorialPosts: EditorialPick[] = [],
): HomeFeedItem[] {
  const items: HomeFeedItem[] = [
    ...charts.map((item) => ({
      kind: "chart" as const,
      id: `chart-${item.chart.id}`,
      createdAt: item.createdAt,
      item,
    })),
    ...reviews.map((item) => ({
      kind: "review" as const,
      id: `review-${item.id}`,
      createdAt: item.createdAt,
      item,
    })),
    ...recommendations.map((item) => ({
      kind: "recommendation" as const,
      id: `rec-${item.id}`,
      createdAt: item.createdAt,
      item,
    })),
    ...systemPosts.map((item) => ({
      kind: "system" as const,
      id: `sys-${item.id}`,
      createdAt: item.createdAt,
      item,
    })),
    ...editorialPosts.map((item) => ({
      kind: "editorial" as const,
      id: `editorial-${item.slug}`,
      createdAt: `${item.publishedAt}T12:00:00.000Z`,
      item,
    })),
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function filterFollowingRecommendations(
  items: RecommendationItem[],
  followingIds: Set<string>,
  userId: string,
): RecommendationItem[] {
  return items.filter((r) => followingIds.has(r.user.id) || r.user.id === userId);
}
