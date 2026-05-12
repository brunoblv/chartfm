"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ChartCard } from "@/components/chart/ChartCard";
import { Avatar } from "@/components/ui/Avatar";
import { scoreColor, scoreBg } from "@/lib/album-score";
import type { UserWithCharts, Chart } from "@/lib/types";

export type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  postedAgo: string;
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
  isFollowing: boolean;
};

function ReviewCard({ review }: { review: ReviewItem }) {
  const truncated =
    review.body && review.body.length > 240
      ? review.body.slice(0, 240) + "…"
      : review.body;

  return (
    <article
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link href={`/profile/${review.user.handle}`} style={{ textDecoration: "none" }}>
          <Avatar user={review.user} imageUrl={review.user.imageUrl} size={40} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Link
              href={`/profile/${review.user.handle}`}
              style={{ textDecoration: "none", color: "#1D1D1F" }}
            >
              {review.user.name}
            </Link>
            {review.user.verified && (
              <BadgeCheck size={14} color="#0A84FF" fill="#0A84FF" />
            )}
          </div>
          <div style={{ fontSize: 12, color: "#86868B" }}>
            @{review.user.handle} · {review.postedAgo}
          </div>
        </div>
        <div
          style={{
            background: scoreBg(review.rating),
            color: scoreColor(review.rating),
            fontWeight: 700,
            fontSize: 18,
            width: 44,
            height: 44,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {review.rating}
        </div>
      </header>

      <div
        style={{
          padding: "0 20px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        {review.album.coverUrl ? (
          <img
            src={review.album.coverUrl}
            alt={review.album.title}
            width={54}
            height={54}
            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 8,
              background: "#f0f0f0",
              flexShrink: 0,
            }}
          />
        )}
        <Link
          href={`/criticsfm/${review.album.id}`}
          style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {review.album.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#86868B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {review.album.artistName}
          </div>
        </Link>
      </div>

      {truncated && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: 14,
            color: "#3D3D3F",
            lineHeight: 1.55,
          }}
        >
          {truncated}
        </div>
      )}

      <div
        style={{
          padding: "10px 20px 14px",
          borderTop: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <Link
          href={`/criticsfm/${review.album.id}`}
          style={{
            fontSize: 13,
            color: "#FA243C",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Ver review completo →
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{message}</div>
      <div style={{ fontSize: 13, color: "#86868B" }}>{sub}</div>
    </div>
  );
}

export function TimelineTabs({
  timelineFeed,
  reviewsFeed,
}: {
  timelineFeed: TimelineItem[];
  reviewsFeed: ReviewItem[];
}) {
  const [activeTab, setActiveTab] = useState<"paradas" | "reviews">("paradas");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "white" : "transparent",
    color: active ? "#1D1D1F" : "#86868B",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "all 150ms",
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "12px 2px 0 2px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 3,
            background: "rgba(0,0,0,0.05)",
            borderRadius: 11,
            padding: 3,
          }}
        >
          <button onClick={() => setActiveTab("paradas")} style={tabStyle(activeTab === "paradas")}>
            Paradas
          </button>
          <button onClick={() => setActiveTab("reviews")} style={tabStyle(activeTab === "reviews")}>
            Reviews
          </button>
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {activeTab === "paradas" ? (
          timelineFeed.length > 0 ? (
            timelineFeed.map((t) => (
              <ChartCard
                key={t.chart.id}
                user={t.user}
                chart={t.chart}
                postedAgo={t.postedAgo}
                isFollowing={t.isFollowing}
              />
            ))
          ) : (
            <EmptyState
              message="Nenhuma parada por aqui ainda"
              sub="Siga mais pessoas para ver as paradas delas aqui"
            />
          )
        ) : reviewsFeed.length > 0 ? (
          reviewsFeed.map((r) => <ReviewCard key={r.id} review={r} />)
        ) : (
          <EmptyState
            message="Nenhum review por aqui ainda"
            sub="Seja o primeiro a avaliar um álbum no CriticsFM"
          />
        )}
      </div>
    </div>
  );
}
