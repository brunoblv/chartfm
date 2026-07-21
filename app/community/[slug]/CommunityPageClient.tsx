"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Share, Heart, MessageCircle, ImagePlus, Check } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import type { Cover as CoverType } from "@/lib/types";
import { useTranslations } from "@/hooks/useTranslations";

export type CommunityWeeklyPollOpen = {
  weekLabel: string;
  dateRange: string;
};

export type CommunityDbSerializable = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  logoUrl: string | null;
  coverA: string;
  coverB: string;
  coverImageUrl: string | null;
  members: number;
  posts: number;
  founded: string;
  ownerName: string | null;
  ownerHandle: string | null;
  paradaName: string;
  isAdmin: boolean;
  isMember: boolean;
};

type DbUser = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
};

export type CommunityReplySerializable = {
  id: string;
  text: string;
  likes: number;
  hasLiked: boolean;
  replyToId: string | null;
  replyToUser: { handle: string; name: string } | null;
  createdAt: string;
  user: DbUser;
};

export type CommunityPostSerializable = {
  id: string;
  kind: "text" | "image" | "youtube";
  text: string;
  imageUrl: string | null;
  imageCaption: string | null;
  youtubeId: string | null;
  ytTitle: string | null;
  ytChannel: string | null;
  ytThumbA: string | null;
  ytThumbB: string | null;
  likes: number;
  hasLiked: boolean;
  replies: number;
  shares: number;
  createdAt: string;
  user: DbUser;
  repliesList: CommunityReplySerializable[];
};

export type CommunityTopSongSerializable = {
  position: number;
  id: string | null;
  title: string;
  artist: string;
  slugArtist: string | null;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  artistRefId: number | null;
  cover: CoverType;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  weeks: number;
};

export type CommunityActiveMemberSerializable = DbUser;

function formatSince(iso: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("communities.timeAgoNow");
  if (min < 60) return t("communities.timeAgoMinutes", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("communities.timeAgoHours", { count: h });
  const d = Math.floor(h / 24);
  return t("communities.timeAgoDays", { count: d });
}

export function CommunityPageClient({
  dbCommunity,
  dbPosts,
  top5,
  activeMembers,
  contributorCount,
  dateRange,
  contextText,
  weeklyPollOpen,
}: {
  dbCommunity: CommunityDbSerializable;
  dbPosts: CommunityPostSerializable[];
  top5: CommunityTopSongSerializable[];
  activeMembers: CommunityActiveMemberSerializable[];
  contributorCount: number;
  dateRange: string;
  contextText: string;
  weeklyPollOpen: CommunityWeeklyPollOpen | null;
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const { data: session } = useSession();
  const isMobile = useIsMobile(960);
  const community = {
    ...dbCommunity,
    cover: [dbCommunity.coverA, dbCommunity.coverB] as [string, string],
    adminName: dbCommunity.ownerName ?? "-",
  };
  const [postMode, setPostMode] = useState<"text" | "image" | "youtube">("text");
  const [postText, setPostText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [postImageDataUrl, setPostImageDataUrl] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [replyingFor, setReplyingFor] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Record<string, CommunityReplySerializable | null>>({});
  const [likingReplyId, setLikingReplyId] = useState<string | null>(null);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [timelinePosts, setTimelinePosts] = useState<CommunityPostSerializable[]>(dbPosts);
  const [isMember, setIsMember] = useState(community.isMember);
  const [memberCount, setMemberCount] = useState(community.members);
  const [joining, setJoining] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  async function toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  }

  async function onSelectImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPostError(t("communities.postImageInvalid"));
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setPostError(t("communities.postImageTooLarge"));
      return;
    }
    try {
      const dataUrl = await toDataUrl(file);
      setPostImageDataUrl(dataUrl);
      setPostError(null);
      setPostMode("image");
    } catch {
      setPostError(t("communities.postImageReadError"));
    }
  }

  async function handleCreatePost() {
    setPostError(null);
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${community.slug}`)}`);
      return;
    }
    const text = postText.trim();
    if (!text) {
      setPostError(t("communities.postTextRequired"));
      return;
    }
    if (postMode === "image" && !postImageDataUrl) {
      setPostError(t("communities.postImageRequired"));
      return;
    }
    if (postMode === "youtube" && !youtubeUrl.trim()) {
      setPostError(t("communities.postYoutubeRequired"));
      return;
    }
    setPosting(true);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: postMode,
          text,
          imageUrl: postMode === "image" ? postImageDataUrl : null,
          youtubeUrl: postMode === "youtube" ? youtubeUrl : null,
        }),
      });
      const data = (await res.json()) as CommunityPostSerializable & { error?: string };
      if (!res.ok) {
        setPostError(data.error ?? t("communities.postCreateError"));
        return;
      }
      setTimelinePosts((prev) => [data, ...prev]);
      setPostText("");
      setYoutubeUrl("");
      setPostImageDataUrl(null);
      setPostMode("text");
    } catch {
      setPostError(t("communities.postNetworkError"));
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(postId: string) {
    const text = (replyDrafts[postId] ?? "").trim();
    if (!text) return;
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${community.slug}`)}`);
      return;
    }
    setReplyingFor(postId);
    setReplyErrors((prev) => ({ ...prev, [postId]: null }));
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, replyToId: replyTarget[postId]?.id ?? null }),
      });
      const data = (await res.json()) as CommunityReplySerializable & { error?: string };
      if (!res.ok) {
        setReplyErrors((prev) => ({ ...prev, [postId]: data.error ?? t("communities.replyError") }));
        return;
      }
      setTimelinePosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                replies: p.replies + 1,
                repliesList: [...p.repliesList, data],
              }
            : p,
        ),
      );
      setReplyDrafts((prev) => ({ ...prev, [postId]: "" }));
      setReplyTarget((prev) => ({ ...prev, [postId]: null }));
    } catch {
      setReplyErrors((prev) => ({ ...prev, [postId]: t("communities.replyNetworkError") }));
    } finally {
      setReplyingFor(null);
    }
  }

  async function handleLikePost(postId: string) {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${community.slug}`)}`);
      return;
    }
    if (likingPostId) return;
    setLikingPostId(postId);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { liked: boolean; likes: number };
      setTimelinePosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: data.likes, hasLiked: data.liked } : p)),
      );
    } finally {
      setLikingPostId(null);
    }
  }

  async function handleLikeReply(postId: string, replyId: string) {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${community.slug}`)}`);
      return;
    }
    if (likingReplyId) return;
    setLikingReplyId(replyId);
    try {
      const res = await fetch(`/api/posts/replies/${encodeURIComponent(replyId)}/like`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { liked: boolean; likes: number };
      setTimelinePosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                repliesList: p.repliesList.map((r) =>
                  r.id === replyId ? { ...r, likes: data.likes, hasLiked: data.liked } : r,
                ),
              }
            : p,
        ),
      );
    } finally {
      setLikingReplyId(null);
    }
  }

  async function handleShareCopy() {
    const url = `${window.location.origin}/community/${community.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt(t("communities.copyLinkPrompt"), url);
    }
  }

  async function handleJoinToggle() {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${community.slug}`)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/members`, {
        method: isMember ? "DELETE" : "POST",
      });
      if (!res.ok) return;
      setIsMember(!isMember);
      setMemberCount((c) => (isMember ? Math.max(0, c - 1) : c + 1));
    } finally {
      setJoining(false);
    }
  }

  const headerData = {
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    cover: community.cover,
    coverImageUrl: community.coverImageUrl,
    icon: community.icon,
    logoUrl: community.logoUrl,
    members: memberCount,
    posts: community.posts,
    founded: community.founded,
    adminName: community.adminName,
    paradaName: community.paradaName,
    isAdmin: community.isAdmin,
  };

  return (
    <Shell title="" noPadding>
      <CommunityHeader
        community={headerData}
        activeTab="posts"
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleJoinToggle()}
              disabled={joining}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: isMember ? "rgba(255,255,255,0.2)" : "white",
                color: isMember ? "white" : community.cover[0],
                border: isMember ? "1px solid rgba(255,255,255,0.35)" : "none",
                padding: "10px 22px",
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 700,
                cursor: joining ? "wait" : "pointer",
              }}
            >
              {joining ? "..." : isMember ? (
                <>
                  <Check size={14} /> {t("communities.joinedLabel")}
                </>
              ) : (
                t("communities.join")
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleShareCopy()}
              title={shareCopied ? t("communities.linkCopiedTitle") : t("communities.copyLinkTitle")}
              aria-label={shareCopied ? t("communities.linkCopiedAria") : t("communities.copyLinkTitle")}
              style={{
                background: shareCopied ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.15)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "10px 22px",
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 600,
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Share size={16} />
              {shareCopied ? t("communities.copiedLabel") : null}
            </button>
          </>
        }
      />

      {contextText && (
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 40px 20px 40px" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderRadius: 18,
              padding: isMobile ? "16px" : "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>
              {contextText}
            </p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
              {t("communities.aboutParagraph")}
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          padding: "0 40px 80px 40px",
          maxWidth: 1300,
          margin: "0 auto",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <div style={{ width: isMobile ? "100%" : 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        {top5.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
            <div style={{ padding: "15px 20px 12px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{community.paradaName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {t("communities.contributorsWeek", { count: contributorCount, range: dateRange })}
                </div>
              </div>
              <Link href={`/community/${community.slug}/parada`} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                {t("communities.viewAllArrow")}
              </Link>
            </div>
            {top5.map((entry) => (
              <div key={entry.position} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: "1px solid var(--divider-soft)" }}>
                <PositionNumber n={entry.position} size={16} />
                <Link href={buildSongPath(entry)} style={{ lineHeight: 0 }}>
                  <Cover cover={entry.cover} song={entry} size={44} rounded={8} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={buildSongPath(entry)} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)", textDecoration: "none" }}>
                    {entry.title}
                  </Link>
                  <Link href={buildArtistPath(entry.artist, entry.artistSpotifyId, entry.artistRefId)} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginTop: 1 }}>
                    {formatSongArtist(entry)}
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <MovementBadge status={entry.status} delta={entry.delta} compact />
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{entry.weeks}s</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeMembers.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "15px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{t("communities.activeMembersTitle")}</div>
              <Link href={`/community/${community.slug}/members`} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                {t("communities.viewAllMembersArrow")}
              </Link>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {activeMembers.map((m) => (
                <Link key={m.id} href={`/profile/${m.handle}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <Avatar user={{ name: m.name, avatar: m.avatarColor }} imageUrl={m.image} size={48} />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 54, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name.split(" ")[0]}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>

        <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Avatar
              user={{
                name: session?.user?.name ?? t("communities.youDefaultName"),
                avatar: "#FA243C",
              }}
              imageUrl={session?.user?.image ?? null}
              size={40}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {(["text", "image", "youtube"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPostMode(mode)}
                    style={{
                      border: "none",
                      borderRadius: 100,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: postMode === mode ? "var(--accent-tint)" : "var(--fill-subtle)",
                      color: postMode === mode ? "var(--accent)" : "var(--text-subtle)",
                    }}
                  >
                    {mode === "text" ? t("communities.modeText") : mode === "image" ? t("communities.modeImage") : t("communities.modeYoutube")}
                  </button>
                ))}
              </div>

              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder={t("communities.postPlaceholder")}
                rows={3}
                style={{
                  width: "100%",
                  border: "1px solid var(--divider)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                  outline: "none",
                  marginBottom: 10,
                  background: "var(--fill-inset)",
                  color: "var(--text)",
                }}
              />

              {postMode === "youtube" && (
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder={t("communities.youtubeLinkPlaceholder")}
                  style={{
                    width: "100%",
                    border: "1px solid var(--divider)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 13,
                    marginBottom: 10,
                    outline: "none",
                    background: "var(--fill-inset)",
                    color: "var(--text)",
                  }}
                />
              )}

              {postMode === "image" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid var(--divider)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    <ImagePlus size={14} />
                    {t("communities.createChooseImage")}
                    <input type="file" accept="image/*" onChange={onSelectImage} style={{ display: "none" }} />
                  </label>
                  {postImageDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={postImageDataUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
                  )}
                </div>
              )}

              {postError && <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 8 }}>{postError}</div>}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{postText.length}/2000</div>
                <button
                  type="button"
                  onClick={() => void handleCreatePost()}
                  disabled={posting}
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: posting ? "wait" : "pointer",
                    opacity: posting ? 0.75 : 1,
                  }}
                >
                  {posting ? t("communities.postSubmitting") : t("communities.postSubmit")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t("communities.recentPostsTitle")}</h3>
        </div>

        {timelinePosts.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)" }}>
            {t("communities.noPostsYet")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {timelinePosts.map((post) => (
              <div key={post.id} style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 16 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <Avatar user={{ name: post.user.name, avatar: post.user.avatarColor }} imageUrl={post.user.image} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{post.user.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{post.user.handle}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {formatSince(post.createdAt, t)}</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap", color: "var(--text)" }}>{post.text}</div>

                    {post.kind === "image" && post.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.imageUrl}
                        alt={post.imageCaption ?? ""}
                        style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, marginTop: 10, border: "1px solid var(--divider)" }}
                      />
                    )}

                    {post.kind === "youtube" && post.youtubeId && (
                      <YouTubeEmbed videoId={post.youtubeId} title={post.ytTitle} />
                    )}

                    <div style={{ marginTop: 10, display: "flex", gap: 18, color: "var(--text-muted)", fontSize: 13 }}>
                      <button
                        type="button"
                        onClick={() => void handleLikePost(post.id)}
                        disabled={likingPostId === post.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          border: "none",
                          background: "none",
                          padding: 0,
                          color: post.hasLiked ? "#FA243C" : "var(--text-muted)",
                          cursor: likingPostId === post.id ? "wait" : "pointer",
                          fontSize: 13,
                        }}
                      >
                        <Heart size={14} fill={post.hasLiked ? "#FA243C" : "none"} /> {post.likes}
                      </button>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MessageCircle size={14} /> {post.replies}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Share size={14} /> {post.shares}
                      </span>
                    </div>

                    <div style={{ marginTop: 12, borderTop: "1px solid var(--divider-soft)", paddingTop: 10, display: "grid", gap: 10 }}>
                      {post.repliesList.map((reply) => (
                        <div
                          key={reply.id}
                          style={{
                            display: "flex",
                            gap: 8,
                            marginLeft: reply.replyToId ? 24 : 0,
                          }}
                        >
                          <Avatar user={{ name: reply.user.name, avatar: reply.user.avatarColor }} imageUrl={reply.user.image} size={30} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              <strong style={{ color: "var(--text)" }}>{reply.user.name}</strong> @{reply.user.handle} · {formatSince(reply.createdAt, t)}
                            </div>
                            {reply.replyToUser && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {t("communities.replyingToHandle", { handle: reply.replyToUser.handle })}
                              </div>
                            )}
                            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>{reply.text}</div>
                            <div style={{ marginTop: 4, display: "flex", gap: 14, color: "var(--text-muted)", fontSize: 12 }}>
                              <button
                                type="button"
                                onClick={() => void handleLikeReply(post.id, reply.id)}
                                disabled={likingReplyId === reply.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  border: "none",
                                  background: "none",
                                  padding: 0,
                                  color: reply.hasLiked ? "#FA243C" : "var(--text-muted)",
                                  cursor: likingReplyId === reply.id ? "wait" : "pointer",
                                  fontSize: 12,
                                }}
                              >
                                <Heart size={13} fill={reply.hasLiked ? "#FA243C" : "none"} /> {reply.likes}
                              </button>
                              <button
                                type="button"
                                onClick={() => setReplyTarget((prev) => ({ ...prev, [post.id]: reply }))}
                                style={{
                                  border: "none",
                                  background: "none",
                                  padding: 0,
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {t("communities.replyCta")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {replyTarget[post.id] && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                          {t("communities.replyingToPrefix")} <strong style={{ color: "var(--text)" }}>@{replyTarget[post.id]?.user.handle}</strong>
                          <button
                            type="button"
                            onClick={() => setReplyTarget((prev) => ({ ...prev, [post.id]: null }))}
                            style={{ border: "none", background: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}
                          >
                            {t("communities.cancelReply")}
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <input
                          value={replyDrafts[post.id] ?? ""}
                          onChange={(e) => {
                            setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }));
                            if (replyErrors[post.id]) setReplyErrors((prev) => ({ ...prev, [post.id]: null }));
                          }}
                          placeholder={
                            replyTarget[post.id]
                              ? t("communities.replyToHandlePlaceholder", { handle: replyTarget[post.id]?.user.handle ?? "" })
                              : t("communities.replyGenericPlaceholder")
                          }
                          style={{
                            flex: 1,
                            border: "1px solid var(--divider)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 13,
                            outline: "none",
                            background: "var(--fill-inset)",
                            color: "var(--text)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleReply(post.id)}
                          disabled={replyingFor === post.id}
                          style={{
                            border: "none",
                            borderRadius: 999,
                            background: "var(--accent)",
                            color: "white",
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: replyingFor === post.id ? "wait" : "pointer",
                            opacity: replyingFor === post.id ? 0.75 : 1,
                          }}
                        >
                          {t("communities.replyCta")}
                        </button>
                      </div>
                      {replyErrors[post.id] && (
                        <div style={{ fontSize: 12, color: "#DC2626" }}>{replyErrors[post.id]}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {!isMobile && (
          <div style={{ width: 296, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: "20px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("communities.pollsTitle")}</div>
              {weeklyPollOpen ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {t("communities.pollOpenText", {
                      week: `${weeklyPollOpen.weekLabel}${weeklyPollOpen.dateRange ? ` (${weeklyPollOpen.dateRange})` : ""}`,
                    })}
                  </div>
                  <Link
                    href={`/community/${encodeURIComponent(dbCommunity.slug)}/votacao`}
                    style={{
                      alignSelf: "flex-start",
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "var(--accent)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    {dbCommunity.isMember ? t("communities.pollVoteCta") : t("communities.pollViewCta")}
                  </Link>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {t("communities.pollClosedText")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
