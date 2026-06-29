"use client";

import { useState } from "react";
import { ChartCard } from "@/components/chart/ChartCard";
import { MixedFeedList } from "@/components/home/MixedFeedList";
import { RecommendationsTab } from "@/components/home/RecommendationsTab";
import { FeedReviewCard } from "@/components/home/FeedReviewCard";
import type { UserWithCharts, Chart } from "@/lib/types";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import type { HomeFeedItem } from "@/lib/home-mixed-feed";
import { useTranslations } from "@/hooks/useTranslations";

export type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  helpful: number;
  postedAgo: string;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
    verified: boolean;
  };
  album: {
    id: number;
    artistId: number;
    title: string;
    coverUrl: string | null;
    artistName: string;
  };
};

export type TimelineItem = {
  user: UserWithCharts;
  chart: Chart;
  postedAgo: string;
  createdAt: string;
  isFollowing: boolean;
  isLiked: boolean;
};

type Tab = "paraVoce" | "seguindo" | "reviews" | "recomendacoes";

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{message}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

export function TimelineTabs({
  forYouFeed,
  followingFeed,
  reviewsFeed,
  recommendationsFeed,
}: {
  forYouFeed: HomeFeedItem[];
  followingFeed: HomeFeedItem[];
  reviewsFeed: ReviewItem[];
  recommendationsFeed: RecommendationItem[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("paraVoce");
  const { t } = useTranslations();

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "all 150ms",
    whiteSpace: "nowrap" as const,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "paraVoce", label: t("timeline.forYou") },
    { key: "seguindo", label: t("timeline.following") },
    { key: "reviews", label: t("timeline.reviews") },
    { key: "recomendacoes", label: t("timeline.recommendations") },
  ];

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          margin: "12px 0 0 0",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            flexShrink: 0,
            background: "var(--fill-subtle)",
            borderRadius: 11,
            padding: 3,
          }}
        >
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={tabStyle(activeTab === tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {activeTab === "paraVoce" ? (
          forYouFeed.length > 0 ? (
            <MixedFeedList items={forYouFeed} />
          ) : (
            <EmptyState message={t("timeline.noFeedYet")} sub={t("timeline.feedWillAppear")} />
          )
        ) : activeTab === "seguindo" ? (
          followingFeed.length > 0 ? (
            <MixedFeedList items={followingFeed} />
          ) : (
            <EmptyState message={t("timeline.noFollowingPosts")} sub={t("timeline.followToSee")} />
          )
        ) : activeTab === "reviews" ? (
          reviewsFeed.length > 0 ? (
            reviewsFeed.map((review) => <FeedReviewCard key={review.id} review={review} />)
          ) : (
            <EmptyState message={t("timeline.noReviews")} sub={t("timeline.beFirstReview")} />
          )
        ) : (
          <RecommendationsTab initialItems={recommendationsFeed} />
        )}
      </div>
    </div>
  );
}
