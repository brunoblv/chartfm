"use client";

import Link from "next/link";
import { Heart, MessageCircle, Repeat2, Share, BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";

import { PositionNumber } from "@/components/ui/PositionNumber";
import { FollowButton } from "@/components/ui/FollowButton";
import { formatSongArtist } from "@/lib/song-artist";
import type { UserWithCharts, Chart } from "@/lib/types";

interface ChartCardProps {
  user: UserWithCharts;
  chart: Chart;
  postedAgo?: string;
  highlightTop?: number;
  isFollowing?: boolean;
  showFollowActions?: boolean;
}

function formatCardPeriod(weekLabel: string, dateRange: string): string {
  const weekMatch = weekLabel.match(/Semana\s+(\d+)/i);
  const yearMatch = weekLabel.match(/(\d{4})/);
  const week = weekMatch?.[1] ?? "";
  const year = yearMatch?.[1] ?? "";
  const range = dateRange.trim();
  if (week && year && range) return `Semana ${week}, ${range}, ${year}`;
  if (week && range) return `Semana ${week}, ${range}`;
  if (range) return range;
  return weekLabel;
}

export function ChartCard({ user, chart, postedAgo, highlightTop = 5, isFollowing, showFollowActions = true }: ChartCardProps) {
  const preview = chart.entries.slice(0, highlightTop);
  const remaining = chart.entries.length - preview.length;
  const formattedPeriod = formatCardPeriod(chart.weekLabel, chart.dateRange);

  return (
    <article style={{
      background: "white",
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      overflow: "hidden",
      transition: "box-shadow 150ms",
    }}>
      {/* Header */}
      <header style={{ padding: "20px 24px 16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
          <Avatar user={user} imageUrl={user.imageUrl} size={44} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", display: "flex", alignItems: "center", gap: 4 }}>
            <Link href={`/profile/${user.handle}`} style={{ textDecoration: "none", color: "#1D1D1F" }}>
              {user.name}
            </Link>
            {(user.verified || user.followers > 2000) && (
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

      {/* Chart title */}
      <Link href={`/chart/${chart.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ padding: "8px 24px 0 24px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Top {chart.entries.length}
        </div>
        <div style={{ padding: "4px 24px 16px 24px", fontSize: 13, color: "#86868B", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{formattedPeriod}</span>
        </div>
      </Link>

      {/* Preview rows */}
      <div style={{ padding: "0 24px 16px 24px", display: "flex", flexDirection: "column", gap: 2 }}>
        {preview.map((entry) => (
          <Link
            key={entry.position}
            href={`/chart/${chart.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 44px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "8px 4px",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <PositionNumber n={entry.position} size={18} />
            <Cover cover={entry.cover} song={entry.song} size={44} rounded={8} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.song.title}
              </div>
              <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatSongArtist(entry.song)}
              </div>
            </div>
          </Link>
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
        {[
          { icon: <Heart size={18} />, count: chart.likes },
          { icon: <MessageCircle size={18} />, count: chart.comments },
          { icon: <Repeat2 size={18} />, count: chart.reposts },
        ].map(({ icon, count }, i) => (
          <button key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            color: "#6B6B70",
            fontSize: 13,
            fontWeight: 500,
          }}>
            {icon}
            <span>{count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#6B6B70" }}>
          <Share size={18} />
        </button>
      </div>
    </article>
  );
}
