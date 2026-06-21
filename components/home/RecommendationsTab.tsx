"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BadgeCheck, Heart, MessageCircle, Music2, Plus, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import { timeAgo } from "@/lib/time-ago";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import { useTranslations } from "@/hooks/useTranslations";
import type { SpotifyTrack } from "@/components/push/push-types";

type SearchHit =
  | { source: "db"; songId: string; spotifyId: string | null; title: string; artist: string; album: string | null; imageUrl: string | null }
  | { source: "spotify"; spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null };

type CommentRow = {
  id: string;
  text: string;
  likes: number;
  liked?: boolean;
  replyCount: number;
  createdAt: string;
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
};

type CommentReplyRow = {
  id: string;
  text: string;
  likes: number;
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

function ShareRecommendationModal({
  onClose,
  onShared,
}: {
  onClose: () => void;
  onShared: (item: RecommendationItem) => void;
}) {
  const { t } = useTranslations();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [dbRes, spotifyRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ac.signal }),
          fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=8`, { signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;

        const dbData = dbRes.ok ? ((await dbRes.json()) as { songs: { id: string; title: string; artist: string; album: string | null; spotifyId: string | null; coverUrl: string | null }[] }) : { songs: [] };
        const spotifyData = spotifyRes.ok ? ((await spotifyRes.json()) as { tracks?: SpotifyTrack[] }) : { tracks: [] };

        const seen = new Set<string>();
        const merged: SearchHit[] = [];

        for (const s of dbData.songs) {
          const key = s.spotifyId ?? `db:${s.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push({
            source: "db",
            songId: s.id,
            spotifyId: s.spotifyId,
            title: s.title,
            artist: s.artist,
            album: s.album,
            imageUrl: s.coverUrl,
          });
        }

        for (const t of spotifyData.tracks ?? []) {
          if (seen.has(t.spotifyId)) continue;
          seen.add(t.spotifyId);
          merged.push({
            source: "spotify",
            spotifyId: t.spotifyId,
            title: t.title,
            artist: t.artist,
            album: t.album,
            imageUrl: t.imageUrl,
          });
        }

        setResults(merged.slice(0, 12));
      } catch {
        if (!ac.signal.aborted) setResults([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [q]);

  async function handleShare() {
    if (!selected || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const body =
        selected.source === "db"
          ? { songId: selected.songId, text: text.trim() || undefined }
          : {
              spotifyId: selected.spotifyId,
              title: selected.title,
              artist: selected.artist,
              album: selected.album,
              text: text.trim() || undefined,
            };
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setError(t("recommendations.loginRequired"));
        return;
      }
      if (!res.ok) {
        setError(t("recommendations.shareError"));
        return;
      }
      const item = (await res.json()) as RecommendationItem;
      onShared(item);
      onClose();
    } catch {
      setError(t("recommendations.shareError"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <Music2 size={18} color="var(--accent)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{t("recommendations.shareTitle")}</span>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "14px 20px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={t("recommendations.searchPlaceholder")}
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelected(null); }}
              style={{
                width: "100%",
                padding: "10px 16px 10px 40px",
                borderRadius: 12,
                border: "1px solid var(--divider-strong)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                background: "var(--fill-inset)",
                color: "var(--text)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px", minHeight: 120 }}>
          {loading && <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>{t("recommendations.searching")}</div>}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>{t("recommendations.noResults")}</div>
          )}
          {results.map((hit) => {
            const key = hit.source === "db" ? hit.songId : hit.spotifyId;
            const active = selected && (
              (selected.source === "db" && hit.source === "db" && selected.songId === hit.songId) ||
              (selected.source === "spotify" && hit.source === "spotify" && selected.spotifyId === hit.spotifyId)
            );
            return (
              <button
                key={key}
                onClick={() => setSelected(hit)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  border: "none",
                  borderRadius: 12,
                  background: active ? "var(--accent-tint)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {hit.imageUrl ? (
                  <img src={hit.imageUrl} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--fill-subtle)", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{hit.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.artist}</div>
                </div>
                {hit.source === "db" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "var(--fill-subtle)", padding: "2px 6px", borderRadius: 4 }}>BD</span>
                )}
              </button>
            );
          })}
        </div>

        {selected && (
          <div style={{ padding: "12px 20px 0", borderTop: "1px solid var(--divider-soft)" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("recommendations.textPlaceholder")}
              rows={3}
              maxLength={1000}
              style={{
                width: "100%",
                border: "1px solid var(--divider)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
                background: "var(--fill-inset)",
                color: "var(--text)",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {error && <div style={{ fontSize: 13, color: "var(--accent)" }}>{error}</div>}
          <button
            onClick={handleShare}
            disabled={!selected || sharing}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: 100,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: !selected || sharing ? "default" : "pointer",
              opacity: !selected || sharing ? 0.5 : 1,
            }}
          >
            {sharing ? t("recommendations.sharing") : t("recommendations.shareButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecommendationCommentItem({
  comment,
  recommendationId,
}: {
  comment: CommentRow;
  recommendationId: string;
}) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<CommentReplyRow[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [liked, setLiked] = useState(comment.liked ?? false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [togglingLike, setTogglingLike] = useState(false);

  async function toggleLike() {
    if (!session?.user || togglingLike) return;
    setTogglingLike(true);
    try {
      const res = await fetch(`/api/recommendations/${recommendationId}/comments/${comment.id}/like`, { method: "POST" });
      if (res.status === 401) {
        alert(t("recommendations.loginRequired"));
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likes: number };
        setLiked(data.liked);
        setLikeCount(data.likes);
      }
    } finally {
      setTogglingLike(false);
    }
  }

  async function loadReplies() {
    setLoadingReplies(true);
    try {
      const res = await fetch(`/api/recommendations/${recommendationId}/comments/${comment.id}/replies`);
      if (res.ok) setReplies((await res.json()) as CommentReplyRow[]);
    } finally {
      setRepliesLoaded(true);
      setLoadingReplies(false);
    }
  }

  function toggleReplies() {
    if (!repliesOpen) {
      setRepliesOpen(true);
      if (!repliesLoaded) loadReplies();
    } else {
      setRepliesOpen(false);
    }
  }

  async function submitReply() {
    const text = replyText.trim();
    if (!text || submittingReply) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/recommendations/${recommendationId}/comments/${comment.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 401) {
        alert(t("recommendations.loginRequired"));
        return;
      }
      if (res.ok) {
        const newReply = (await res.json()) as CommentReplyRow;
        setReplies((prev) => [...prev, newReply]);
        setReplyCount((n) => n + 1);
        setReplyText("");
        if (!repliesLoaded) setRepliesLoaded(true);
        if (!repliesOpen) setRepliesOpen(true);
      }
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--divider-soft)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Link href={`/profile/${comment.user.handle}`}>
          <Avatar user={{ name: comment.user.name, avatar: comment.user.avatarColor }} imageUrl={comment.user.image ?? undefined} size={32} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Link href={`/profile/${comment.user.handle}`} style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--text)" }}>
              {comment.user.name}
            </Link>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{comment.user.handle}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{timeAgo(comment.createdAt)}</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 8px", color: "var(--text-subtle)" }}>{comment.text}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={toggleLike}
              disabled={togglingLike}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: liked ? "var(--accent-tint)" : "none",
                border: "none",
                color: liked ? "var(--accent)" : "var(--text-muted)",
                fontSize: 13,
                cursor: session?.user ? "pointer" : "default",
                borderRadius: 100,
                padding: liked ? "4px 8px" : "4px 0",
                opacity: togglingLike ? 0.6 : 1,
              }}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              onClick={toggleReplies}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none",
                color: repliesOpen ? "var(--accent)" : "var(--text-muted)",
                fontSize: 13, fontWeight: repliesOpen ? 600 : 400, cursor: "pointer",
              }}
            >
              <MessageCircle size={14} />
              {replyCount > 0
                ? t("recommendations.replyCount", { count: replyCount })
                : t("recommendations.reply")}
            </button>
          </div>
        </div>
      </div>

      {repliesOpen && (
        <div style={{ marginLeft: 42, marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--divider-soft)" }}>
          {loadingReplies && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>{t("recommendations.loadingReplies")}</div>}
          {replies.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Link href={`/profile/${r.user.handle}`}>
                <Avatar user={{ name: r.user.name, avatar: r.user.avatarColor }} imageUrl={r.user.image ?? undefined} size={24} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.user.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{timeAgo(r.createdAt)}</span>
                </div>
                <p style={{ fontSize: 13, margin: 0, color: "var(--text-subtle)", lineHeight: 1.45 }}>{r.text}</p>
              </div>
            </div>
          ))}
          {session?.user && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                placeholder={t("recommendations.replyPlaceholder")}
                style={{
                  flex: 1, border: "1px solid var(--divider)", borderRadius: 100,
                  padding: "6px 14px", fontSize: 13, outline: "none",
                  background: "var(--fill-inset)", color: "var(--text)",
                }}
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || submittingReply}
                style={{
                  background: "var(--accent)", color: "white", border: "none",
                  padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700,
                  opacity: !replyText.trim() || submittingReply ? 0.5 : 1,
                  cursor: !replyText.trim() || submittingReply ? "default" : "pointer",
                }}
              >
                {t("recommendations.sendReply")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  item,
  onCommentCountChange,
}: {
  item: RecommendationItem;
  onCommentCountChange: (id: string, delta: number) => void;
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

  const cover = songCover(item.song.title, item.song.artist);
  const songPath = buildSongPath({
    id: item.song.id,
    title: item.song.title,
    artist: item.song.artist,
    slugArtist: item.song.artist,
    spotifyId: item.song.spotifyId,
    artistRefId: item.song.artistRefId,
  });

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
        onCommentCountChange(item.id, 1);
        if (!commentsLoaded) setCommentsLoaded(true);
        if (!commentsOpen) setCommentsOpen(true);
      }
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <article style={{
      background: "var(--surface)",
      borderRadius: 18,
      border: "1px solid var(--divider)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}>
      <header style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/profile/${item.user.handle}`}>
          <Avatar user={{ name: item.user.name, avatar: item.user.avatar }} imageUrl={item.user.imageUrl ?? undefined} size={40} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600 }}>
            <Link href={`/profile/${item.user.handle}`} style={{ textDecoration: "none", color: "var(--text)" }}>
              {item.user.name}
            </Link>
            {item.user.verified && <BadgeCheck size={14} color="#0A84FF" fill="#0A84FF" />}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            @{item.user.handle} · {item.postedAgo}
          </div>
        </div>
      </header>

      {item.text && (
        <div style={{ padding: "0 20px 12px", fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.55 }}>
          {item.text}
        </div>
      )}

      <div style={{ padding: "0 20px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <Link href={songPath} style={{ lineHeight: 0, flexShrink: 0 }}>
          {item.song.coverUrl ? (
            <img src={item.song.coverUrl} alt={item.song.title} width={54} height={54} style={{ borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <Cover
              cover={{ palette: cover.palette, seed: cover.seed, imageUrl: null }}
              song={{ title: item.song.title, artist: item.song.artist }}
              size={54}
              rounded={8}
            />
          )}
        </Link>
        <Link href={songPath} style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.song.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {formatSongArtist({ artist: item.song.artist })}
          </div>
        </Link>
      </div>

      <div style={{ padding: "10px 20px 14px", borderTop: "1px solid var(--divider-soft)", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={toggleLike}
          disabled={liking}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: liked ? "var(--accent-tint)" : "none",
            border: "none",
            color: liked ? "var(--accent)" : "var(--text-muted)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            borderRadius: 100,
            padding: liked ? "6px 10px" : "6px 0",
          }}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {likeCount > 0 ? likeCount : t("recommendations.like")}
        </button>
        <button
          onClick={toggleComments}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none",
            color: commentsOpen ? "var(--accent)" : "var(--text-muted)",
            fontSize: 13, fontWeight: commentsOpen ? 700 : 600,
            cursor: "pointer",
          }}
        >
          <MessageCircle size={16} />
          {commentCount > 0 ? commentCount : t("recommendations.comment")}
        </button>
      </div>

      {commentsOpen && (
        <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--divider-soft)" }}>
          {session?.user && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 0" }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder={t("recommendations.commentPlaceholder")}
                style={{
                  flex: 1, border: "1px solid var(--divider)", borderRadius: 100,
                  padding: "8px 14px", fontSize: 13, outline: "none",
                  background: "var(--fill-inset)", color: "var(--text)",
                }}
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                style={{
                  background: "var(--accent)", color: "white", border: "none",
                  padding: "8px 16px", borderRadius: 100, fontSize: 12, fontWeight: 700,
                  opacity: !commentText.trim() || submittingComment ? 0.5 : 1,
                  cursor: !commentText.trim() || submittingComment ? "default" : "pointer",
                }}
              >
                {t("recommendations.sendComment")}
              </button>
            </div>
          )}
          {loadingComments && <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>{t("recommendations.loadingComments")}</div>}
          {!loadingComments && comments.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>{t("recommendations.noComments")}</div>
          )}
          {comments.map((c) => (
            <RecommendationCommentItem key={c.id} comment={c} recommendationId={item.id} />
          ))}
        </div>
      )}
    </article>
  );
}

export function RecommendationsTab({ initialItems }: { initialItems: RecommendationItem[] }) {
  const { t } = useTranslations();
  const [items, setItems] = useState(initialItems);
  const [modalOpen, setModalOpen] = useState(false);

  function handleShared(item: RecommendationItem) {
    setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
  }

  function handleCommentCountChange(id: string, delta: number) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, comments: p.comments + delta } : p)));
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 100,
            border: "none", background: "var(--accent)", color: "white",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
          }}
        >
          <Plus size={16} />
          {t("recommendations.shareCta")}
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{
          background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎧</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t("recommendations.emptyTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.emptySub")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item) => (
            <RecommendationCard key={item.id} item={item} onCommentCountChange={handleCommentCountChange} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ShareRecommendationModal
          onClose={() => setModalOpen(false)}
          onShared={handleShared}
        />
      )}
    </div>
  );
}
