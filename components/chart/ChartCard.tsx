"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Repeat2, Share, BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { FollowButton } from "@/components/ui/FollowButton";
import { formatChartPeriod } from "@/lib/chart-week";
import { formatSongArtist } from "@/lib/song-artist";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import type { UserWithCharts, Chart } from "@/lib/types";

interface ChartCardProps {
  user: UserWithCharts;
  chart: Chart;
  postedAgo?: string;
  highlightTop?: number;
  isFollowing?: boolean;
  showFollowActions?: boolean;
  showUserHeader?: boolean;
}

export function ChartCard({
  user,
  chart,
  postedAgo,
  highlightTop = 5,
  isFollowing,
  showFollowActions = true,
  showUserHeader = true,
}: ChartCardProps) {
  const preview = chart.entries.slice(0, highlightTop);
  const remaining = chart.entries.length - preview.length;
  const formattedPeriod = formatChartPeriod(chart);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(chart.likes);
  const [liking, setLiking] = useState(false);

  async function toggleLike() {
    if (!chart.id || liking) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiking(true);
    setLiked(!prevLiked);
    setLikeCount((c) => c + (prevLiked ? -1 : 1));
    try {
      const res = await fetch(`/api/charts/${chart.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error("like_failed");
      const data = (await res.json()) as { liked?: boolean; likes?: number };
      if (typeof data.liked === "boolean") setLiked(data.liked);
      if (typeof data.likes === "number") setLikeCount(data.likes);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  }

  return (
    <article style={{
      background: "white",
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      overflow: "hidden",
      transition: "box-shadow 150ms",
    }}>
      {showUserHeader && (
        <header style={{ padding: "20px 24px 16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          {user.paradaLogo && (
            <img
              src={user.paradaLogo}
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <Link href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
            <Avatar user={user} imageUrl={user.imageUrl} size={44} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", display: "flex", alignItems: "center", gap: 4 }}>
              <Link href={`/profile/${user.handle}`} style={{ textDecoration: "none", color: "#1D1D1F" }}>
                {user.name}
              </Link>
              {user.verified && (
                <BadgeCheck size={16} color="#0A84FF" fill="#0A84FF" />
              )}
            </div>
            <div style={{ fontSize: 13, color: "#86868B" }}>
              @{user.handle}{postedAgo ? ` · ${postedAgo}` : ""}
            </div>
          </div>
          {showFollowActions && (
            <FollowButton targetId={user.id} initialFollowing={isFollowing} />
          )}
        </header>
      )}

      {/* Chart title */}
      <Link href={`/chart/${chart.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ padding: "8px 24px 0 24px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {user.paradaNome || `Top ${chart.entries.length}`}
        </div>
        <div style={{ padding: "4px 24px 16px 24px", fontSize: 13, color: "#86868B", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{formattedPeriod}</span>
        </div>
      </Link>

      {/* Preview rows */}
      <div style={{ padding: "0 24px 16px 24px", display: "flex", flexDirection: "column", gap: 2 }}>
        {preview.map((entry) => (
          <div
            key={entry.position}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 44px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "8px 4px",
              borderRadius: 8,
              color: "inherit",
            }}
          >
            <Link
              href={`/chart/${chart.id}`}
              prefetch={false}
              style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "flex-end" }}
            >
              <PositionNumber n={entry.position} size={18} />
            </Link>
            <Link href={buildSongPath(entry.song)} prefetch={false} style={{ textDecoration: "none", color: "inherit", lineHeight: 0 }}>
              <Cover cover={entry.cover} song={entry.song} size={44} rounded={8} />
            </Link>
            <div style={{ minWidth: 0 }}>
              <Link
                href={buildSongPath(entry.song)}
                prefetch={false}
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {entry.song.title}
              </Link>
              <Link
                href={buildArtistPath(entry.song.artist, entry.song.artistSpotifyId, entry.song.artistRefId)}
                prefetch={false}
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#86868B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                }}
              >
                {formatSongArtist(entry.song)}
              </Link>
            </div>
            <MovementBadge status={entry.status} delta={entry.delta} compact />
          </div>
        ))}
        {remaining > 0 && (
          <Link
            href={`/chart/${chart.id}`}
            style={{ padding: "10px 4px 2px 4px", fontSize: 13, color: "#FA243C", fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none" }}
          >
            Ver completa
          </Link>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 14px 14px 14px",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}>
        <button
          onClick={toggleLike}
          disabled={liking}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            color: liked ? "#C5291C" : "#6B6B70",
            fontSize: 13,
            fontWeight: 500,
            cursor: liking ? "default" : "pointer",
            opacity: liking ? 0.7 : 1,
          }}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount > 0 ? likeCount : ""}</span>
        </button>
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", borderRadius: 8, background: "transparent",
          border: "none", color: "#6B6B70", fontSize: 13, fontWeight: 500,
        }}>
          <MessageCircle size={18} />
          <span>{chart.comments > 0 ? chart.comments : ""}</span>
        </button>
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", borderRadius: 8, background: "transparent",
          border: "none", color: "#6B6B70", fontSize: 13, fontWeight: 500,
        }}>
          <Repeat2 size={18} />
          <span>{chart.reposts > 0 ? chart.reposts : ""}</span>
        </button>
        <div style={{ flex: 1 }} />
        <button style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#6B6B70" }}>
          <Share size={18} />
        </button>
      </div>
    </article>
  );
}
