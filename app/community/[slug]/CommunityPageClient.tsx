"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Play, Share, Heart, MessageCircle, ImagePlus } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COMMUNITIES, POSTS, USERS_DATA } from "@/lib/data";
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
  members: number;
  posts: number;
  founded: string;
  ownerName: string | null;
  ownerHandle: string | null;
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

type Tab = "chart" | "posts" | "members";

type ViewModel = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  cover: [string, string];
  icon: string;
  logoUrl: string | null;
  members: number;
  posts: number;
  founded: string;
  adminName: string;
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
      icon: db.icon,
      logoUrl: db.logoUrl,
      members: db.members,
      posts: db.posts,
      founded: db.founded,
      adminName: db.ownerName ?? "—",
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
      icon: mock.icon,
      logoUrl: null,
      members: mock.members,
      posts: mock.posts,
      founded: mock.founded,
      adminName: mock.admins[0]?.name ?? "—",
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
  const [tab, setTab] = useState<Tab>("posts");
  const [postMode, setPostMode] = useState<"text" | "image" | "youtube">("text");
  const [postText, setPostText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [postImageDataUrl, setPostImageDataUrl] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingFor, setReplyingFor] = useState<string | null>(null);
  const [timelinePosts, setTimelinePosts] = useState<CommunityPostSerializable[]>(dbPosts);

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

  return (
    <Shell title="" noPadding>
      <div
        style={{
          background: `linear-gradient(135deg, ${community.cover[0]}, ${community.cover[1]})`,
          padding: "48px 40px 40px 40px",
          color: "white",
        }}
      >
        <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 24,
              flexShrink: 0,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              overflow: "hidden",
            }}
          >
            {community.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.logoUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              community.icon
            )}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <h1 style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
              {community.name}
            </h1>
            <p style={{ fontSize: 16, opacity: 0.85, marginBottom: 16 }}>{community.tagline}</p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.85, marginBottom: 20 }}>
              <span>
                <strong>{community.members.toLocaleString("pt-BR")}</strong> membros
              </span>
              <span>
                <strong>{community.posts}</strong> posts
              </span>
              <span>Fundada em {community.founded}</span>
              <span>
                Moderado por <strong>{community.adminName}</strong>
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{
                  background: "white",
                  color: community.cover[0],
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 100,
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✓ Participando
              </button>
              <button
                style={{
                  background: "rgba(255,255,255,0.15)",
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
                }}
              >
                <Share size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 80px 40px" }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 28, marginTop: 0 }}>
          {([["chart", "Parada"], ["posts", "Posts"], ["members", "Membros"]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "16px 24px",
                background: "none",
                border: "none",
                fontSize: 15,
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? "#1D1D1F" : "#86868B",
                borderBottom: `2px solid ${tab === t ? community.cover[0] : "transparent"}`,
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "chart" && (
          <div>
            <p style={{ fontSize: 14, color: "#86868B", marginBottom: 20 }}>
              {community.chart.length === 0
                ? "Quando houver paradas publicadas pelos membros, a agregação semanal aparecerá aqui."
                : `Agregada a partir das paradas dos ${community.memberSample?.length ?? 0} membros mais ativos desta semana.`}
            </p>
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {community.chart.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "#86868B", fontSize: 14 }}>
                  Sem dados de parada por enquanto.
                </div>
              ) : (
                community.chart.map((e) => (
                  <div
                    key={e.position}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 64px 1fr 100px 100px 100px",
                      alignItems: "center",
                      padding: "8px 20px",
                      borderBottom: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: e.position <= 3 ? 24 : 18,
                        fontWeight: 700,
                        color: "#000000",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        paddingRight: 12,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {e.position}
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      <Cover cover={e.cover} song={e.song} size={48} rounded={8} />
                    </div>
                    <div style={{ padding: "0 12px", minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.title}</div>
                      <div style={{ fontSize: 12, color: "#86868B" }}>{e.song.artist}</div>
                    </div>
                    <div style={{ padding: "0 8px" }}>
                      <MovementBadge status={e.status} delta={e.delta} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FA243C", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{e.points}</div>
                    <div style={{ fontSize: 13, color: "#86868B", padding: "0 8px" }}>{e.voters} eleitores</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "posts" && (
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

                          {post.kind === "youtube" && (
                            <a
                              href={post.youtubeId ? `https://www.youtube.com/watch?v=${post.youtubeId}` : "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                marginTop: 10,
                                display: "block",
                                borderRadius: 12,
                                overflow: "hidden",
                                textDecoration: "none",
                                border: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              <div
                                style={{
                                  height: 170,
                                  background: `linear-gradient(135deg, ${post.ytThumbA ?? "#0A0A0A"}, ${post.ytThumbB ?? "#1A1A1A"})`,
                                  color: "white",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 44,
                                  fontWeight: 800,
                                }}
                              >
                                ▶
                              </div>
                              <div style={{ padding: "10px 12px", background: "#fff", color: "#1D1D1F", fontSize: 13, fontWeight: 600 }}>
                                {post.ytTitle ?? "Vídeo do YouTube"}
                              </div>
                            </a>
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
        )}

        {tab === "members" && (
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 48px 1fr 120px 120px 110px",
                padding: "10px 20px",
                background: "rgba(0,0,0,0.02)",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {["#", "", "Membro", "Posts", "Curtidas", ""].map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#86868B",
                    padding: "4px 8px",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {community.source === "db" && dbCommunity ? (
              dbCommunity.ownerHandle ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 48px 1fr 120px 120px 110px",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>1</div>
                <div style={{ padding: "0 6px" }}>
                  <Avatar user={{ name: dbCommunity.ownerName ?? "Fundador", avatar: "#FA243C" }} size={36} />
                </div>
                <div style={{ padding: "0 10px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{dbCommunity.ownerName ?? "Fundador"}</div>
                  <Link href={`/profile/${dbCommunity.ownerHandle}`} style={{ fontSize: 12, color: "#86868B", textDecoration: "none" }}>
                    @{dbCommunity.ownerHandle}
                  </Link>
                </div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>—</div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>—</div>
                <div style={{ padding: "0 8px" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Dono</span>
                </div>
              </div>
              ) : (
                <div style={{ padding: 20, fontSize: 14, color: "#86868B" }}>Membros serão listados aqui em breve.</div>
              )
            ) : (
              USERS_DATA.slice(0, 6).map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 48px 1fr 120px 120px 110px",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{i + 1}</div>
                  <div style={{ padding: "0 6px" }}>
                    <Avatar user={u} size={36} />
                  </div>
                  <div style={{ padding: "0 10px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "#86868B" }}>@{u.handle}</div>
                  </div>
                  <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{[42, 38, 31, 27, 19, 12][i]}</div>
                  <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{[1204, 987, 823, 654, 432, 287][i]}</div>
                  <div style={{ padding: "0 8px" }}>
                    <button
                      type="button"
                      style={{ background: "#1D1D1F", color: "white", border: "none", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}
                    >
                      Seguir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
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
