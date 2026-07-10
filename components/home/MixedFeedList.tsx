"use client";

import { ChartCard } from "@/components/chart/ChartCard";
import { FeedReviewCard } from "@/components/home/FeedReviewCard";
import { FeedRecommendationCard } from "@/components/home/FeedRecommendationCard";
import { FeedSystemPostCard } from "@/components/home/FeedSystemPostCard";
import { FeedEditorialCard } from "@/components/home/FeedEditorialCard";
import type { HomeFeedItem } from "@/lib/home-mixed-feed";

export function MixedFeedList({ items }: { items: HomeFeedItem[] }) {
  return (
    <>
      {items.map((entry) => {
        if (entry.kind === "chart") {
          const { item } = entry;
          return (
            <ChartCard
              key={entry.id}
              user={item.user}
              chart={item.chart}
              postedAgo={item.postedAgo}
              isFollowing={item.isFollowing}
              initialLiked={item.isLiked}
            />
          );
        }
        if (entry.kind === "review") {
          return <FeedReviewCard key={entry.id} review={entry.item} />;
        }
        if (entry.kind === "system") {
          return <FeedSystemPostCard key={entry.id} item={entry.item} />;
        }
        if (entry.kind === "editorial") {
          return <FeedEditorialCard key={entry.id} pick={entry.item} />;
        }
        return <FeedRecommendationCard key={entry.id} item={entry.item} />;
      })}
    </>
  );
}
