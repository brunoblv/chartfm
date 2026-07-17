"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import { timeAgo } from "@/lib/time-ago";
import { useTranslations } from "@/hooks/useTranslations";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import type { AutoMomentItem } from "@/lib/moments-feed";
import { isMomentType } from "@/lib/moments-feed";
import { AUTO_MOMENT_TYPE_META, MOMENT_TYPE_META } from "./moment-types";
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

function TypeChip({ labelKey, Icon, muted }: { labelKey: string; Icon: React.ElementType; muted?: boolean }) {
  const { t } = useTranslations();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        padding: "4px 10px",
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 700,
        background: muted ? "var(--fill-subtle)" : "var(--accent-tint)",
        color: muted ? "var(--text-subtle)" : "var(--accent)",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} />
      {t(labelKey)}
    </span>
  );
}

function RatingSquare({ rating }: { rating: number }) {
  const good = rating >= 8;
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 15,
        background: good ? "var(--up-bg, #E7F8EC)" : "var(--fill-subtle)",
        color: good ? "var(--up-fg, #1B873F)" : "var(--text-subtle)",
      }}
    >
      {rating}
    </div>
  );
}

export function MomentCard({
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

  const meta = isMomentType(item.type) ? MOMENT_TYPE_META[item.type] : MOMENT_TYPE_META.recomendo;
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
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Link href={`/profile/${item.user.handle}`} style={{ flexShrink: 0 }}>
          <Avatar
            user={{ name: item.user.name, avatar: item.user.avatar }}
            imageUrl={item.user.imageUrl ?? undefined}
            size={38}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link
              href={`/profile/${item.user.handle}`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
            >
              {item.user.name}
            </Link>
            {item.user.verified && <BadgeCheck size={14} color="#0A84FF" fill="#0A84FF" />}
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>@{item.user.handle}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.postedAgo}</div>
        </div>
        <TypeChip labelKey={meta.labelKey} Icon={meta.Icon} />
      </div>

      {item.text && (
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--text)" }}>{item.text}</p>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "var(--fill-inset)",
          border: "1px solid var(--divider-soft)",
          borderRadius: 14,
          padding: "10px 14px",
        }}
      >
        {isYoutube && item.youtube ? (
          <>
            <a
              href={youtubeWatchUrl(item.youtube.id)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ lineHeight: 0, flexShrink: 0 }}
            >
              <img
                src={youtubeThumbnailUrl(item.youtube.id)}
                alt={item.youtube.title ?? "YouTube"}
                width={88}
                height={50}
                style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
              />
            </a>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={youtubeWatchUrl(item.youtube.id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.youtube.title ?? t("recommendations.youtubeFallback")}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {item.youtube.channel ?? "YouTube"}
                </div>
              </a>
            </div>
          </>
        ) : songPath && item.song ? (
          <>
            <Link href={songPath} style={{ lineHeight: 0, flexShrink: 0 }}>
              {item.song.coverUrl ? (
                <img
                  src={item.song.coverUrl}
                  alt={item.song.title}
                  width={56}
                  height={56}
                  style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
                />
              ) : cover ? (
                <Cover
                  cover={{ palette: cover.palette, seed: cover.seed, imageUrl: null }}
                  song={{ title: item.song.title, artist: item.song.artist }}
                  size={56}
                  rounded={10}
                />
              ) : null}
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={songPath} style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.song.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatSongArtist({ artist: item.song.artist })}
                </div>
              </Link>
            </div>
            {item.type === "review" && typeof item.rating === "number" && (
              <RatingSquare rating={item.rating} />
            )}
          </>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: liked ? "var(--accent)" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: 600,
            padding: "4px 12px 4px 0",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount > 0 ? likeCount : ""}</span>
        </button>
        <button
          type="button"
          onClick={toggleComments}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: commentsOpen ? "var(--accent)" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: 600,
            padding: "4px 12px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <MessageCircle size={16} />
          <span>{commentCount > 0 ? commentCount : ""}</span>
        </button>
      </div>

      {commentsOpen && (
        <div style={{ borderTop: "1px solid var(--divider-soft)", paddingTop: 14 }}>
          {session?.user && (
            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              <Avatar
                user={{ name: session.user.name ?? "?", avatar: "#FA243C" }}
                imageUrl={session.user.image ?? undefined}
                size={30}
              />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  background: "var(--fill-subtle)",
                  borderRadius: 100,
                  padding: "8px 14px",
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
                    fontSize: 13.5,
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
                    fontSize: 12.5,
                  }}
                >
                  {t("recommendations.sendComment")}
                </button>
              </div>
            </div>
          )}
          {loadingComments && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "6px 0" }}>
              {t("recommendations.loadingComments")}
            </div>
          )}
          {!loadingComments && comments.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "6px 0" }}>
              {t("recommendations.noComments")}
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <Link href={`/profile/${c.user.handle}`}>
                <Avatar
                  user={{ name: c.user.name, avatar: c.user.avatarColor }}
                  imageUrl={c.user.image ?? undefined}
                  size={30}
                />
              </Link>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "var(--fill-subtle)",
                  borderRadius: 14,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{c.user.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @{c.user.handle} · {timeAgo(c.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-subtle)", lineHeight: 1.5 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/** Card automático do sistema: grande subida/queda numa parada pessoal. */
export function AutoMomentCard({ item }: { item: AutoMomentItem }) {
  const { t } = useTranslations();
  const meta = AUTO_MOMENT_TYPE_META[item.type];
  const cover = songCover(item.song.title, item.song.artist);
  const songPath = buildSongPath({
    id: item.song.id,
    title: item.song.title,
    artist: item.song.artist,
    slugArtist: item.song.artist,
    spotifyId: item.song.spotifyId,
    artistRefId: item.song.artistRefId,
  });

  return (
    <article
      style={{
        background: "var(--fill-inset)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Link href={`/profile/${item.user.handle}`} style={{ flexShrink: 0 }}>
          <Avatar
            user={{ name: item.user.name, avatar: item.user.avatar }}
            imageUrl={item.user.imageUrl ?? undefined}
            size={38}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link
              href={`/profile/${item.user.handle}`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
            >
              {item.user.name}
            </Link>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>@{item.user.handle}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.postedAgo}</div>
        </div>
        <TypeChip labelKey={meta.labelKey} Icon={meta.Icon} muted />
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-subtle)", lineHeight: 1.5 }}>
        {t(item.type === "subiu" ? "moments.autoUpText" : "moments.autoDownText", {
          delta: item.delta,
          position: item.position,
        })}{" "}
        <Link href={`/chart/${item.chartId}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
          {t("moments.autoViewChart")}
        </Link>
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--divider-soft)",
          borderRadius: 14,
          padding: "10px 14px",
        }}
      >
        <Link href={songPath} style={{ lineHeight: 0, flexShrink: 0 }}>
          {item.song.coverUrl ? (
            <img
              src={item.song.coverUrl}
              alt={item.song.title}
              width={56}
              height={56}
              style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
            />
          ) : (
            <Cover
              cover={{ palette: cover.palette, seed: cover.seed, imageUrl: null }}
              song={{ title: item.song.title, artist: item.song.artist }}
              size={56}
              rounded={10}
            />
          )}
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={songPath} style={{ textDecoration: "none", color: "inherit" }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.song.title}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {formatSongArtist({ artist: item.song.artist })}
            </div>
          </Link>
        </div>
        <MovementBadge
          status={item.type === "subiu" ? "up" : "down"}
          delta={item.type === "subiu" ? item.delta : -item.delta}
        />
      </div>
    </article>
  );
}
