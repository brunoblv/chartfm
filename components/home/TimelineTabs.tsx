"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/chart/ChartCard";
import { Avatar } from "@/components/ui/Avatar";
import { scoreColor, scoreBg } from "@/lib/album-score";
import { RELEASES, TAG_META } from "@/lib/releases-data";
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
  isLiked: boolean;
};

type Tab = "amigos" | "todos" | "reviews" | "noticias";

function ReviewCard({ review }: { review: ReviewItem }) {
  const truncated =
    review.body && review.body.length > 240
      ? review.body.slice(0, 240) + "…"
      : review.body;

  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <header style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/profile/${review.user.handle}`} style={{ textDecoration: "none" }}>
          <Avatar user={review.user} imageUrl={review.user.imageUrl} size={40} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600 }}>
            <Link href={`/profile/${review.user.handle}`} style={{ textDecoration: "none", color: "var(--text)" }}>
              {review.user.name}
            </Link>
            {review.user.verified && <BadgeCheck size={14} color="#0A84FF" fill="#0A84FF" />}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            @{review.user.handle} · {review.postedAgo}
          </div>
        </div>
        <div style={{
          background: scoreBg(review.rating), color: scoreColor(review.rating),
          fontWeight: 700, fontSize: 18, width: 44, height: 44, borderRadius: 10,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {review.rating}
        </div>
      </header>

      <div style={{ padding: "0 20px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        {review.album.coverUrl ? (
          <img src={review.album.coverUrl} alt={review.album.title} width={54} height={54}
            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 54, height: 54, borderRadius: 8, background: "var(--fill-subtle)", flexShrink: 0 }} />
        )}
        <Link href={`/criticsfm/${review.album.id}`} style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {review.album.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {review.album.artistName}
          </div>
        </Link>
      </div>

      {truncated && (
        <div style={{ padding: "0 20px 16px", fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.55 }}>
          {truncated}
        </div>
      )}

      <div style={{ padding: "10px 20px 14px", borderTop: "1px solid var(--divider-soft)" }}>
        <Link href={`/criticsfm/${review.album.id}`} style={{ fontSize: 13, color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          Ver review completo →
        </Link>
      </div>
    </article>
  );
}

function NewsTab() {
  const recent = RELEASES.slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {recent.map((release) => (
        <div key={release.date}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(250,36,60,0.07)", borderRadius: 100,
              padding: "5px 12px 5px 9px",
            }}>
              <Sparkles size={12} color="#FA243C" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FA243C", letterSpacing: "-0.01em" }}>
                {release.label}
              </span>
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--divider)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {release.entries.map((entry, i) => {
              const meta = TAG_META[entry.tag];
              return (
                <article key={i} style={{
                  background: "var(--surface)", borderRadius: 14,
                  border: "1px solid var(--divider)", padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 140 }}>
                      {entry.title}
                    </span>
                    <span style={{
                      display: "inline-flex", padding: "2px 8px", borderRadius: 100,
                      fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color,
                    }}>
                      {meta.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.6, margin: 0 }}>
                    {entry.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <Link href="/whats-new" style={{ fontSize: 13, color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          Ver todas as novidades →
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)",
      padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{message}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

export function TimelineTabs({
  friendsFeed,
  allFeed,
  reviewsFeed,
}: {
  friendsFeed: TimelineItem[];
  allFeed: TimelineItem[];
  reviewsFeed: ReviewItem[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("amigos");

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
    { key: "amigos", label: "Amigos" },
    { key: "todos", label: "Todos" },
    { key: "reviews", label: "Reviews" },
    { key: "noticias", label: "Notícias" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 2px 0 2px" }}>
        <div style={{
          display: "flex", gap: 3,
          background: "var(--fill-subtle)",
          borderRadius: 11, padding: 3,
          overflowX: "auto",
        }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabStyle(activeTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--divider)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {activeTab === "amigos" ? (
          friendsFeed.length > 0 ? (
            friendsFeed.map((t) => (
              <ChartCard key={t.chart.id} user={t.user} chart={t.chart}
                postedAgo={t.postedAgo} isFollowing={t.isFollowing} initialLiked={t.isLiked} />
            ))
          ) : (
            <EmptyState
              message="Nenhuma parada de amigos ainda"
              sub="Siga pessoas para ver as paradas delas aqui"
            />
          )
        ) : activeTab === "todos" ? (
          allFeed.length > 0 ? (
            allFeed.map((t) => (
              <ChartCard key={t.chart.id} user={t.user} chart={t.chart}
                postedAgo={t.postedAgo} isFollowing={t.isFollowing} initialLiked={t.isLiked} />
            ))
          ) : (
            <EmptyState
              message="Nenhuma parada por aqui ainda"
              sub="Quando usuários publicarem suas paradas elas aparecerão aqui"
            />
          )
        ) : activeTab === "reviews" ? (
          reviewsFeed.length > 0 ? (
            reviewsFeed.map((r) => <ReviewCard key={r.id} review={r} />)
          ) : (
            <EmptyState
              message="Nenhum review por aqui ainda"
              sub="Seja o primeiro a avaliar um álbum no CriticsFM"
            />
          )
        ) : (
          <NewsTab />
        )}
      </div>
    </div>
  );
}
