"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Play, Share, Heart, MessageCircle, ImagePlus } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { COMMUNITIES, POSTS } from "@/lib/data";
import type { Community } from "@/lib/types";

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
  replies: number;
  shares: number;
  createdAt: string;
  user: DbUser;
  repliesList: CommunityReplySerializable[];
};

type ViewModel = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  cover: [string, string];
  coverImageUrl: string | null;
  icon: string;
  logoUrl: string | null;
  members: number;
  posts: number;
  founded: string;
  adminName: string;
  paradaName: string;
  isAdmin: boolean;
  isMember: boolean;
  chart: Community["chart"];
  memberSample: Community["memberSample"];
  source: "db" | "mock";
};

function buildViewModel(db: CommunityDbSerializable | null, mock: Community | null): ViewModel {
  if (db) {
    return {
      id: db.id,
      slug: db.slug,
      name: db.name,
      tagline: db.tagline,
      cover: [db.coverA, db.coverB],
      coverImageUrl: db.coverImageUrl,
      icon: db.icon,
      logoUrl: db.logoUrl,
      members: db.members,
      posts: db.posts,
      founded: db.founded,
      adminName: db.ownerName ?? "—",
      paradaName: db.paradaName,
      isAdmin: db.isAdmin,
      isMember: db.isMember,
      chart: [],
      memberSample: [],
      source: "db",
    };
  }
  if (mock) {
    return {
      id: mock.id,
      slug: mock.slug,
      name: mock.name,
      tagline: mock.tagline,
      cover: mock.cover,
      coverImageUrl: null,
      icon: mock.icon,
      logoUrl: null,
      members: mock.members,
      posts: mock.posts,
      founded: mock.founded,
      adminName: mock.admins[0]?.name ?? "—",
      paradaName: "Parada",
      isAdmin: false,
      isMember: true,
      chart: mock.chart,
      memberSample: mock.memberSample,
      source: "mock",
    };
  }
  return buildViewModel(null, COMMUNITIES[0]);
}

export function CommunityPageClient({
  dbCommunity,
  mockCommunity,
  dbPosts,
}: {
  dbCommunity: CommunityDbSerializable | null;
  mockCommunity: Community | null;
  dbPosts: CommunityPostSerializable[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const community = useMemo(() => buildViewModel(dbCommunity, mockCommunity), [dbCommunity, mockCommunity]);
  const [postMode, setPostMode] = useState<"text" | "image" | "youtube">("text");
  const [postText, setPostText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [postImageDataUrl, setPostImageDataUrl] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingFor, setReplyingFor] = useState<string | null>(null);
  const [timelinePosts, setTimelinePosts] = useState<CommunityPostSerializable[]>(dbPosts);
  const [isMember, setIsMember] = useState(community.isMember);
  const [memberCount, setMemberCount] = useState(community.members);
  const [joining, setJoining] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const allPosts = community.source === "mock" ? POSTS : [];

  function formatSince(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
  }

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
      setPostError("Arquivo inválido. Envie uma imagem.");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setPostError("Imagem muito grande (máx. 1 MB).");
      return;
    }
    try {
      const dataUrl = await toDataUrl(file);
      setPostImageDataUrl(dataUrl);
      setPostError(null);
      setPostMode("image");
    } catch {
      setPostError("Não foi possível ler a imagem.");
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
      setPostError("Digite algo para publicar.");
      return;
    }
    if (postMode === "image" && !postImageDataUrl) {
      setPostError("Selecione uma imagem para publicar nesse modo.");
      return;
    }
    if (postMode === "youtube" && !youtubeUrl.trim()) {
      setPostError("Cole o link do YouTube.");
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
        setPostError(data.error ?? "Não foi possível criar o post.");
        return;
      }
      setTimelinePosts((prev) => [data, ...prev]);
      setPostText("");
      setYoutubeUrl("");
      setPostImageDataUrl(null);
      setPostMode("text");
    } catch {
      setPostError("Erro de rede ao criar post.");
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
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as CommunityReplySerializable & { error?: string };
      if (!res.ok) return;
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
    } finally {
      setReplyingFor(null);
    }
  }

  async function handleShareCopy() {
    const url = `${window.location.origin}/community/${community.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Copie o link da comunidade:", url);
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

  const postsPanel = (
    <div>
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar
                  user={{
                    name: session?.user?.name ?? "Você",
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
                          background:
                            postMode === mode ? (mode === "youtube" ? "rgba(220,40,40,0.1)" : "rgba(29,29,31,0.1)") : "rgba(0,0,0,0.04)",
                          color: postMode === mode ? "#1D1D1F" : "#6B6B70",
                        }}
                      >
                        {mode === "text" ? "Texto" : mode === "image" ? "Imagem" : "YouTube"}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="O que você quer compartilhar?"
                    rows={3}
                    style={{
                      width: "100%",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 14,
                      resize: "vertical",
                      fontFamily: "inherit",
                      outline: "none",
                      marginBottom: 10,
                    }}
                  />

                  {postMode === "youtube" && (
                    <input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Cole o link do YouTube"
                      style={{
                        width: "100%",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 10,
                        padding: "9px 12px",
                        fontSize: 13,
                        marginBottom: 10,
                        outline: "none",
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
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <ImagePlus size={14} />
                        Escolher imagem
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
                    <div style={{ fontSize: 12, color: "#86868B" }}>{postText.length}/2000</div>
                    <button
                      type="button"
                      onClick={() => void handleCreatePost()}
                      disabled={posting}
                      style={{
                        background: community.cover[0],
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
                      {posting ? "Postando..." : "Postar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Posts recentes</h3>
              {community.source === "mock" && (
                <Link
                  href={`/community/${community.slug}/feed`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#1D1D1F",
                    color: "white",
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Play size={12} fill="white" />
                  Ver no modo imersivo
                </Link>
              )}
            </div>

            {community.source === "db" ? (
              timelinePosts.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#86868B", fontSize: 14, background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)" }}>
                  Nenhum post nesta comunidade ainda.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {timelinePosts.map((post) => (
                    <div key={post.id} style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <Avatar user={{ name: post.user.name, avatar: post.user.avatarColor }} imageUrl={post.user.image} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{post.user.name}</span>
                            <span style={{ fontSize: 12, color: "#86868B" }}>@{post.user.handle}</span>
                            <span style={{ fontSize: 12, color: "#86868B" }}>· {formatSince(post.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap" }}>{post.text}</div>

                          {post.kind === "image" && post.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.imageUrl}
                              alt={post.imageCaption ?? ""}
                              style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, marginTop: 10, border: "1px solid rgba(0,0,0,0.08)" }}
                            />
                          )}

                          {post.kind === "youtube" && post.youtubeId && (
                            <YouTubeEmbed videoId={post.youtubeId} title={post.ytTitle} />
                          )}

                          <div style={{ marginTop: 10, display: "flex", gap: 18, color: "#6B6B70", fontSize: 13 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Heart size={14} /> {post.likes}
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MessageCircle size={14} /> {post.replies}
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Share size={14} /> {post.shares}
                            </span>
                          </div>

                          <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10, display: "grid", gap: 10 }}>
                            {post.repliesList.map((reply) => (
                              <div key={reply.id} style={{ display: "flex", gap: 8 }}>
                                <Avatar user={{ name: reply.user.name, avatar: reply.user.avatarColor }} imageUrl={reply.user.image} size={30} />
                                <div>
                                  <div style={{ fontSize: 12, color: "#86868B" }}>
                                    <strong style={{ color: "#1D1D1F" }}>{reply.user.name}</strong> @{reply.user.handle} · {formatSince(reply.createdAt)}
                                  </div>
                                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{reply.text}</div>
                                </div>
                              </div>
                            ))}

                            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                              <input
                                value={replyDrafts[post.id] ?? ""}
                                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Responder este post..."
                                style={{
                                  flex: 1,
                                  border: "1px solid rgba(0,0,0,0.12)",
                                  borderRadius: 999,
                                  padding: "8px 12px",
                                  fontSize: 13,
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleReply(post.id)}
                                disabled={replyingFor === post.id}
                                style={{
                                  border: "none",
                                  borderRadius: 999,
                                  background: "#1D1D1F",
                                  color: "white",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: replyingFor === post.id ? "wait" : "pointer",
                                  opacity: replyingFor === post.id ? 0.75 : 1,
                                }}
                              >
                                Responder
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {allPosts.map((post) => (
                  <PostCard key={post.id} post={post} communityColor={community.cover[0]} />
                ))}
              </div>
            )}
    </div>
  );

  return (
    <Shell title="" noPadding>
      {community.source === "db" ? (
        <>
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
                  {joining ? "..." : isMember ? "✓ Participando" : "Participar"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareCopy()}
                  title={shareCopied ? "Link copiado!" : "Copiar link da comunidade"}
                  aria-label={shareCopied ? "Link copiado" : "Copiar link da comunidade"}
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
                  {shareCopied ? "Copiado!" : null}
                </button>
              </>
            }
          />
          <div style={{ padding: "28px 40px 80px 40px" }}>{postsPanel}</div>
        </>
      ) : (
        <div style={{ padding: "28px 40px 80px 40px" }}>
          <Link
            href={`/community/${community.slug}/feed`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#1D1D1F",
              color: "white",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            <Play size={12} fill="white" />
            Ver no modo imersivo
          </Link>
          {postsPanel}
        </div>
      )}
    </Shell>
  );
}

function PostCard({ post, communityColor }: { post: (typeof POSTS)[0]; communityColor: string }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
      <div style={{ aspectRatio: "4/5", position: "relative", overflow: "hidden" }}>
        {post.kind === "image" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${post.imagePalette?.[0] ?? "#FA243C"}, ${post.imagePalette?.[1] ?? "#FF5858"})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "white",
                textAlign: "center",
                padding: "0 16px",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
                letterSpacing: "-0.03em",
              }}
            >
              {post.imageText}
            </div>
          </div>
        )}
        {post.kind === "youtube" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${post.ytThumb?.[0] ?? "#0A0A0A"}, ${post.ytThumb?.[1] ?? "#1A1A1A"})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "12px solid transparent",
                  borderBottom: "12px solid transparent",
                  borderLeft: "20px solid white",
                  marginLeft: 4,
                }}
              />
            </div>
            <div style={{ color: "white", fontSize: 13, fontWeight: 600, textAlign: "center", padding: "0 16px", opacity: 0.9 }}>{post.ytTitle}</div>
          </div>
        )}
        {post.kind === "text" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `${communityColor}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1D1D1F",
                lineHeight: 1.5,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 6,
              }}
            >
              {post.text}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar user={post.user} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.user.name}</div>
          <div style={{ fontSize: 11, color: "#86868B" }}>{post.postedAgo}</div>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#86868B" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Heart size={12} /> {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <MessageCircle size={12} /> {post.replies}
          </span>
        </div>
      </div>
    </div>
  );
}
