"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BadgeCheck,
  Bookmark,
  Heart,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import { timeAgo } from "@/lib/time-ago";
import { useTranslations } from "@/hooks/useTranslations";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube-id";

type CommentRow = {
  id: string;
  text: string;
  likes: number;
  liked?: boolean;
  replyCount: number;
  createdAt: string;
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
};

function songCover(title: string, artist: string): { palette: [string, string]; seed: number } {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const abs = Math.abs(hash);
  return { palette: COVER_PALETTES[abs % COVER_PALETTES.length], seed: abs };
}

export function FeedRecommendationCard({
  item,
  onCommentCountChange,
}: {
  item: RecommendationItem;
  onCommentCountChange?: (id: string, delta: number) => void;
}) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [liked, setLiked] = useState(item.liked);
  const [likeCount, setLikeCount] = useState(item.likes);
  const [commentCount, setCommentCount] = useState(item.comments);
  const [liking, setLiking] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const isYoutube = item.kind === "youtube" && !!item.youtube;
  const cover = item.song ? songCover(item.song.title, item.song.artist) : null;
  const songPath = item.song
    ? buildSongPath({
        id: item.song.id,
        title: item.song.title,
        artist: item.song.artist,
        slugArtist: item.song.artist,
        spotifyId: item.song.spotifyId,
        artistRefId: item.song.artistRefId,
      })
    : null;

  async function toggleLike() {
    if (liking) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount((c) => c + (prevLiked ? -1 : 1));
    try {
      const res = await fetch(`/api/recommendations/${item.id}/like`, { method: "POST" });
      if (res.status === 401) {
        setLiked(prevLiked);
        setLikeCount(prevCount);
        alert(t("recommendations.loginRequired"));
        return;
      }
      if (!res.ok) throw new Error("like_failed");
      const data = (await res.json()) as { liked: boolean; likes: number };
      setLiked(data.liked);
      setLikeCount(data.likes);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/recommendations/${item.id}/comments`);
      if (res.ok) setComments((await res.json()) as CommentRow[]);
    } finally {
      setCommentsLoaded(true);
      setLoadingComments(false);
    }
  }

  function toggleComments() {
    if (!commentsOpen) {
      setCommentsOpen(true);
      if (!commentsLoaded) loadComments();
    } else {
      setCommentsOpen(false);
    }
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/recommendations/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 401) {
        alert(t("recommendations.loginRequired"));
        return;
      }
      if (res.ok) {
        const newComment = (await res.json()) as CommentRow;
        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
        setCommentCount((c) => c + 1);
        onCommentCountChange?.(item.id, 1);
        if (!commentsLoaded) setCommentsLoaded(true);
        if (!commentsOpen) setCommentsOpen(true);
      }
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start", padding: "20px 20px 0" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Link href={`/profile/${item.user.handle}`}>
            <Avatar
              user={{ name: item.user.name, avatar: item.user.avatar }}
              imageUrl={item.user.imageUrl ?? undefined}
              size={44}
            />
          </Link>
          <span
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#30D158",
              border: "2px solid var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Lightbulb size={8} strokeWidth={2.5} />
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
              href={`/profile/${item.user.handle}`}
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              {item.user.name}
            </Link>
            {item.user.verified && <BadgeCheck size={15} color="#0A84FF" fill="#0A84FF" />}
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>@{item.user.handle}</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.postedAgo}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 9px",
                borderRadius: 100,
                background: "#30D15820",
                color: "#30D158",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t("timeline.indicacaoBadge")}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
            {t("timeline.actionIndicacao")}
          </div>
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

      <div style={{ padding: "0 20px" }}>
        <div
          style={{
            border: "1px solid var(--divider)",
            borderRadius: 16,
            overflow: "hidden",
            background: "var(--bg)",
            display: "flex",
            alignItems: "stretch",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}
        >
        <div
          style={{
            width: 4,
            flexShrink: 0,
            background: "linear-gradient(180deg,#30D158,#34C759)",
          }}
        />
        <div style={{ flex: 1, padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
          {isYoutube && item.youtube ? (
            <a
              href={youtubeWatchUrl(item.youtube.id)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ lineHeight: 0, flexShrink: 0, position: "relative" }}
            >
              <img
                src={youtubeThumbnailUrl(item.youtube.id)}
                alt={item.youtube.title ?? "YouTube"}
                width={96}
                height={54}
                style={{ borderRadius: 12, objectFit: "cover", display: "block" }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 12,
                }}
              >
                <span
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderLeft: "12px solid white",
                    marginLeft: 2,
                  }}
                />
              </span>
            </a>
          ) : songPath && item.song ? (
            <Link href={songPath} style={{ lineHeight: 0, flexShrink: 0 }}>
              {item.song.coverUrl ? (
                <img
                  src={item.song.coverUrl}
                  alt={item.song.title}
                  width={60}
                  height={60}
                  style={{ borderRadius: 12, objectFit: "cover" }}
                />
              ) : cover ? (
                <Cover
                  cover={{ palette: cover.palette, seed: cover.seed, imageUrl: null }}
                  song={{ title: item.song.title, artist: item.song.artist }}
                  size={60}
                  rounded={12}
                />
              ) : null}
            </Link>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "#30D158",
                marginBottom: 5,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Lightbulb size={11} strokeWidth={2.5} />
              {t("timeline.indicacaoBadge")}
            </div>
            {isYoutube && item.youtube ? (
              <a
                href={youtubeWatchUrl(item.youtube.id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.youtube.title ?? t("recommendations.youtubeFallback")}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  {item.youtube.channel ?? "YouTube"}
                </div>
              </a>
            ) : songPath && item.song ? (
              <Link href={songPath} style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.song.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  {formatSongArtist({ artist: item.song.artist })}
                </div>
              </Link>
            ) : null}
            {item.text && (
              <p style={{ fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.65, margin: 0 }}>
                {item.text}
              </p>
            )}
          </div>
        </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 18,
          padding: "14px 20px 20px",
          borderTop: "1px solid var(--divider-soft)",
        }}
      >
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: liked ? "var(--accent)" : "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px 6px 0",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
          <span style={{ fontWeight: 500 }}>{likeCount > 0 ? likeCount : ""}</span>
        </button>
        <button
          type="button"
          onClick={toggleComments}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: commentsOpen ? "var(--accent)" : "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <MessageCircle size={17} />
          <span style={{ fontWeight: 500 }}>{commentCount > 0 ? commentCount : ""}</span>
        </button>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Repeat2 size={17} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          style={{
            color: "var(--text-muted)",
            padding: "6px 8px",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          <Share2 size={17} />
        </button>
        <button
          type="button"
          style={{
            color: "var(--text-muted)",
            padding: "6px 2px 6px 4px",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          <Bookmark size={17} />
        </button>
      </div>

      {commentsOpen && (
        <div
          style={{
            marginTop: 0,
            padding: "0 20px 20px",
            borderTop: "1px solid var(--divider-soft)",
            paddingTop: 18,
          }}
        >
          {session?.user && (
            <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
              <Avatar
                user={{
                  name: session.user.name ?? "?",
                  avatar: "#FA243C",
                }}
                imageUrl={session.user.image ?? undefined}
                size={34}
              />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  background: "var(--fill-subtle)",
                  borderRadius: 100,
                  padding: "9px 16px",
                  gap: 10,
                }}
              >
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                  placeholder={t("recommendations.commentPlaceholder")}
                  style={{
                    flex: 1,
                    background: "none",
                    fontSize: 14,
                    color: "var(--text)",
                    border: "none",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!commentText.trim() || submittingComment}
                  style={{
                    color: "var(--accent)",
                    background: "none",
                    border: "none",
                    cursor: !commentText.trim() || submittingComment ? "default" : "pointer",
                    opacity: !commentText.trim() || submittingComment ? 0.5 : 1,
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {t("recommendations.sendComment")}
                </button>
              </div>
            </div>
          )}
          {loadingComments && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              {t("recommendations.loadingComments")}
            </div>
          )}
          {!loadingComments && comments.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              {t("recommendations.noComments")}
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
              <Link href={`/profile/${c.user.handle}`}>
                <Avatar
                  user={{ name: c.user.name, avatar: c.user.avatarColor }}
                  imageUrl={c.user.image ?? undefined}
                  size={34}
                />
              </Link>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "var(--fill-subtle)",
                  borderRadius: 14,
                  padding: "11px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginBottom: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.user.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @{c.user.handle} · {timeAgo(c.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.55 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
