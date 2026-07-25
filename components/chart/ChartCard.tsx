"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  BadgeCheck,
  Bookmark,
  MoreHorizontal,
  Music,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { FollowButton } from "@/components/ui/FollowButton";
import { JoinCommunityChip } from "@/components/community/JoinCommunityChip";
import { formatChartPeriod } from "@/lib/chart-week";
import { formatSongArtist } from "@/lib/song-artist";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import type { UserWithCharts, Chart } from "@/lib/types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";

interface ChartCardProps {
  user: UserWithCharts;
  chart: Chart;
  postedAgo?: string;
  highlightTop?: number;
  isFollowing?: boolean;
  initialLiked?: boolean;
  showFollowActions?: boolean;
  showUserHeader?: boolean;
  variant?: "default" | "feed";
  actionLabel?: string;
}

function LockedActionBar({ likeCount, comments, feedStyle }: { likeCount: number; comments: number; feedStyle?: boolean }) {
  const { t } = useTranslations();
  const lockBtnStyle = {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    background: "none" as const,
    border: "none" as const,
    padding: "6px 8px",
    borderRadius: 8,
    textDecoration: "none",
    cursor: "pointer" as const,
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: feedStyle ? "14px 0 0" : "8px 14px 14px 14px",
        borderTop: "1px solid var(--divider-soft)",
        marginTop: feedStyle ? 18 : 0,
      }}
    >
      <Link href="/login" title={t("chart.loginToLikeTooltip")} style={lockBtnStyle}>
        <Lock size={14} />
        {likeCount > 0
          ? t(likeCount === 1 ? "chart.likeSingular" : "chart.likePlural", { count: likeCount })
          : t("chart.like")}
      </Link>
      <Link href="/login" title={t("chart.loginToCommentTooltip")} style={lockBtnStyle}>
        <Lock size={14} />
        {comments > 0
          ? t(comments === 1 ? "chart.commentSingular" : "chart.commentPlural", { count: comments })
          : t("chart.comment")}
      </Link>
    </div>
  );
}

function ActionBar({
  liked,
  liking,
  likeCount,
  comments,
  reposts,
  onLike,
  onComment,
  feedStyle,
}: {
  liked: boolean;
  liking: boolean;
  likeCount: number;
  comments: number;
  reposts: number;
  onLike: () => void;
  onComment: () => void;
  feedStyle?: boolean;
}) {
  const btnStyle = feedStyle
    ? {
        display: "flex" as const,
        alignItems: "center" as const,
        gap: 7,
        fontSize: 14,
        padding: "6px 16px 6px 0",
        border: "none" as const,
        background: "none" as const,
        cursor: "pointer" as const,
        fontFamily: "inherit" as const,
      }
    : {
        display: "flex" as const,
        alignItems: "center" as const,
        gap: 6,
        padding: "8px 12px",
        borderRadius: 8,
        background: "transparent" as const,
        border: "none" as const,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer" as const,
      };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: feedStyle ? 0 : 4,
        padding: feedStyle ? "14px 0 0" : "8px 14px 14px 14px",
        borderTop: "1px solid var(--divider-soft)",
        marginTop: feedStyle ? 18 : 0,
      }}
    >
      <button
        type="button"
        onClick={onLike}
        disabled={liking}
        style={{
          ...btnStyle,
          color: liked ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <Heart size={feedStyle ? 17 : 18} fill={liked ? "currentColor" : "none"} />
        <span style={{ fontWeight: 500 }}>{likeCount > 0 ? likeCount : ""}</span>
      </button>
      <button
        type="button"
        onClick={onComment}
        style={{
          ...btnStyle,
          color: "var(--text-muted)",
          padding: feedStyle ? "6px 16px" : btnStyle.padding,
        }}
      >
        <MessageCircle size={feedStyle ? 17 : 18} />
        <span style={{ fontWeight: 500 }}>{comments > 0 ? comments : ""}</span>
      </button>
      <button
        type="button"
        style={{
          ...btnStyle,
          color: "var(--text-muted)",
          padding: feedStyle ? "6px 16px" : btnStyle.padding,
        }}
      >
        <Repeat2 size={feedStyle ? 17 : 18} />
        <span style={{ fontWeight: 500 }}>{reposts > 0 ? reposts : ""}</span>
      </button>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        style={{
          ...btnStyle,
          color: "var(--text-muted)",
          padding: feedStyle ? "6px 8px" : btnStyle.padding,
        }}
      >
        <Share size={feedStyle ? 17 : 18} />
      </button>
      {feedStyle && (
        <button
          type="button"
          style={{
            ...btnStyle,
            color: "var(--text-muted)",
            padding: "6px 2px 6px 4px",
          }}
        >
          <Bookmark size={17} />
        </button>
      )}
    </div>
  );
}

export function ChartCard({
  user,
  chart,
  postedAgo,
  highlightTop,
  isFollowing,
  initialLiked = false,
  showFollowActions = true,
  showUserHeader = true,
  variant = "default",
  actionLabel,
}: ChartCardProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { t, locale } = useTranslations();
  const { data: session } = useSession();
  const authed = Boolean(session?.user?.id);
  const isFeed = variant === "feed";
  const topN = highlightTop ?? (isFeed ? 3 : 5);
  const preview = chart.entries.slice(0, topN);
  const totalTracks = chart.entryCount ?? chart.entries.length;
  const remaining = totalTracks - preview.length;
  const formattedPeriod = formatChartPeriod(chart, locale);
  const chartName = chart.paradaNome || user.paradaNome || `Top ${totalTracks}`;
  const community = chart.community ?? null;
  const posterHref = community ? `/community/${community.slug}` : `/profile/${user.handle}`;
  const posterName = community ? community.name : user.name;
  const posterAvatarUser = community
    ? { name: community.name, avatar: community.coverA }
    : user;
  const posterAvatarImageUrl = community ? community.logoUrl : user.imageUrl;
  const [liked, setLiked] = useState(initialLiked);
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

  const openComments = () => {
    if (chart.id) router.push(`/chart/${chart.id}?tab=comments`);
  };

  if (isFeed) {
    return (
      <article
        style={{
          padding: isMobile ? "22px 16px" : "28px 28px",
          borderBottom: "1px solid var(--divider)",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            marginBottom: 18,
            alignItems: "flex-start",
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Link href={posterHref}>
              <Avatar user={posterAvatarUser} imageUrl={posterAvatarImageUrl} size={44} />
            </Link>
            <span
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--accent)",
                border: "2px solid var(--surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Music size={8} strokeWidth={2.5} />
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexWrap: "wrap",
                lineHeight: 1.2,
              }}
            >
              <Link
                href={posterHref}
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                }}
              >
                {posterName}
              </Link>
              {!community && user.verified && (
                <BadgeCheck size={15} color="#0A84FF" fill="#0A84FF" />
              )}
              {!community && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  @{user.handle}
                </span>
              )}
              {postedAgo && (
                <>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>·</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {postedAgo}
                  </span>
                </>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 9px",
                  borderRadius: 100,
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Parada
              </span>
              {community && <JoinCommunityChip slug={community.slug} />}
            </div>
            {actionLabel && (
              <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
                {actionLabel}
              </div>
            )}
          </div>
          <button
            type="button"
            style={{
              padding: 4,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div
          style={{
            border: "1px solid var(--divider)",
            borderRadius: 16,
            overflow: "hidden",
            background: "var(--bg)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "14px 16px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--accent-tint)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.02em",
                }}
              >
                {chartName}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {formattedPeriod} · {t("chart.tracksCount", { count: totalTracks })}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 100,
                background: "var(--accent)",
                color: "#fff",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              PARADA
            </span>
          </div>
          {preview.map((entry) => (
            <div
              key={entry.position}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <PositionNumber n={entry.position} size={18} />
              <Link href={buildSongPath(entry.song)} prefetch={false} style={{ lineHeight: 0 }}>
                <Cover cover={entry.cover} song={entry.song} size={42} rounded={10} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={buildSongPath(entry.song)}
                  prefetch={false}
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                  }}
                >
                  {entry.song.title}
                </Link>
                <Link
                  href={buildArtistPath(
                    entry.song.artist,
                    entry.song.artistSpotifyId,
                    entry.song.artistRefId,
                  )}
                  prefetch={false}
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 1,
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
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {remaining > 0 ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                + {remaining} faixas
              </span>
            ) : (
              <span />
            )}
            <Link
              href={`/chart/${chart.id}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--accent)",
                padding: "7px 14px",
                borderRadius: 100,
                background: "var(--accent-tint)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {t("chart.viewFull")} <ChevronRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {authed ? (
          <ActionBar
            feedStyle
            liked={liked}
            liking={liking}
            likeCount={likeCount}
            comments={chart.comments}
            reposts={chart.reposts}
            onLike={toggleLike}
            onComment={openComments}
          />
        ) : (
          <LockedActionBar feedStyle likeCount={likeCount} comments={chart.comments} />
        )}
      </article>
    );
  }

  return (
    <article
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
        transition: "box-shadow 150ms",
      }}
    >
      {showUserHeader && (
        <header
          style={{
            padding: "20px 24px 16px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {!community && user.paradaLogo && (
            <img
              src={user.paradaLogo}
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <Link href={posterHref} style={{ textDecoration: "none" }}>
            <Avatar user={posterAvatarUser} imageUrl={posterAvatarImageUrl} size={44} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Link
                href={posterHref}
                style={{ textDecoration: "none", color: "var(--text)" }}
              >
                {posterName}
              </Link>
              {!community && user.verified && (
                <BadgeCheck size={16} color="#0A84FF" fill="#0A84FF" />
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {community ? chartName : `@${user.handle}`}
              {postedAgo ? ` · ${postedAgo}` : ""}
            </div>
          </div>
          {community ? (
            <JoinCommunityChip slug={community.slug} />
          ) : (
            showFollowActions && (
              <FollowButton targetId={user.id} initialFollowing={isFollowing} />
            )
          )}
        </header>
      )}

      <Link
        href={`/chart/${chart.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            padding: "8px 24px 0 24px",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          {chartName}
        </div>
        <div
          style={{
            padding: "4px 24px 16px 24px",
            fontSize: 13,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>{formattedPeriod}</span>
        </div>
      </Link>

      <div
        style={{
          padding: "0 24px 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
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
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <PositionNumber n={entry.position} size={18} />
            </Link>
            <Link
              href={buildSongPath(entry.song)}
              prefetch={false}
              style={{ textDecoration: "none", color: "inherit", lineHeight: 0 }}
            >
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
                href={buildArtistPath(
                  entry.song.artist,
                  entry.song.artistSpotifyId,
                  entry.song.artistRefId,
                )}
                prefetch={false}
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--text-muted)",
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
            style={{
              padding: "10px 4px 2px 4px",
              fontSize: 13,
              color: "var(--accent)",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            {t("chart.viewFull")}
          </Link>
        )}
      </div>

      {authed ? (
        <ActionBar
          liked={liked}
          liking={liking}
          likeCount={likeCount}
          comments={chart.comments}
          reposts={chart.reposts}
          onLike={toggleLike}
          onComment={openComments}
        />
      ) : (
        <LockedActionBar likeCount={likeCount} comments={chart.comments} />
      )}
    </article>
  );
}
