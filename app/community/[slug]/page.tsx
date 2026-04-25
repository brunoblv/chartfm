"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, Share, Heart, MessageCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COMMUNITIES, POSTS, USERS_DATA } from "@/lib/data";

type Tab = "chart" | "posts" | "members";

export default function CommunityPage({ params }: { params: { slug: string } }) {
  const community = COMMUNITIES.find((c) => c.slug === params.slug) ?? COMMUNITIES[0];
  const [tab, setTab] = useState<Tab>("posts");

  const communityPosts = POSTS.filter((p) => p.community.id === community.id);
  const allPosts = POSTS;

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${community.cover[0]}, ${community.cover[1]})`,
        padding: "48px 40px 40px 40px",
        color: "white",
      }}>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Community icon */}
          <div style={{
            width: 140, height: 140, borderRadius: 24, flexShrink: 0,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 64,
          }}>
            {community.icon}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <h1 style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
              {community.name}
            </h1>
            <p style={{ fontSize: 16, opacity: 0.85, marginBottom: 16 }}>{community.tagline}</p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.85, marginBottom: 20 }}>
              <span><strong>{community.members.toLocaleString("pt-BR")}</strong> membros</span>
              <span><strong>{community.posts}</strong> posts</span>
              <span>Fundada em {community.founded}</span>
              <span>Moderado por <strong>{community.admins[0]?.name}</strong></span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{
                background: "white", color: community.cover[0], border: "none",
                padding: "10px 22px", borderRadius: 100, fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                ✓ Participando
              </button>
              <button style={{
                background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)",
                padding: "10px 22px", borderRadius: 100, fontSize: 14, fontWeight: 600,
                backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: 6,
              }}>
                <Share size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 80px 40px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 28, marginTop: 0 }}>
          {([["chart", "Parada"], ["posts", "Posts"], ["members", "Membros"]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
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

        {/* Chart tab */}
        {tab === "chart" && (
          <div>
            <p style={{ fontSize: 14, color: "#86868B", marginBottom: 20 }}>
              Agregada a partir das paradas dos {community.memberSample?.length ?? 0} membros mais ativos desta semana.
            </p>
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {community.chart.map((e) => (
                <div key={e.position} style={{
                  display: "grid", gridTemplateColumns: "60px 64px 1fr 100px 100px 100px",
                  alignItems: "center", padding: "8px 20px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: e.position <= 3 ? 24 : 18, fontWeight: 700, color: "#000000", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 12, letterSpacing: "-0.04em" }}>
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
              ))}
            </div>
          </div>
        )}

        {/* Posts tab */}
        {tab === "posts" && (
          <div>
            {/* Compose bar */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar user={USERS_DATA[0]} size={40} />
                <div style={{ flex: 1, background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: "10px 14px", color: "#86868B", fontSize: 14, cursor: "text" }}>
                  Compartilhe algo com a comunidade...
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ background: "rgba(0,0,0,0.06)", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    🖼️ Imagem
                  </button>
                  <button style={{ background: "rgba(220,40,40,0.08)", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#C5291C", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    ▶️ YouTube
                  </button>
                  <button style={{
                    background: community.cover[0], color: "white", border: "none",
                    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  }}>
                    Postar
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Posts recentes</h3>
              <Link href={`/community/${community.slug}/feed`} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#1D1D1F", color: "white", textDecoration: "none",
                padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600,
              }}>
                <Play size={12} fill="white" />
                Ver no modo imersivo
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {allPosts.map((post) => (
                <PostCard key={post.id} post={post} communityColor={community.cover[0]} />
              ))}
            </div>
          </div>
        )}

        {/* Members tab */}
        {tab === "members" && (
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 48px 1fr 120px 120px 110px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {["#", "", "Membro", "Posts", "Curtidas", ""].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "4px 8px" }}>{h}</div>
              ))}
            </div>
            {USERS_DATA.slice(0, 6).map((u, i) => (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "40px 48px 1fr 120px 120px 110px",
                alignItems: "center", padding: "12px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
              }}>
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
                  <button style={{ background: "#1D1D1F", color: "white", border: "none", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    Seguir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function PostCard({ post, communityColor }: { post: (typeof POSTS)[0]; communityColor: string }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
      {/* Media area — 4:5 aspect */}
      <div style={{ aspectRatio: "4/5", position: "relative", overflow: "hidden" }}>
        {post.kind === "image" && (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${post.imagePalette?.[0] ?? "#FA243C"}, ${post.imagePalette?.[1] ?? "#FF5858"})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "white", textAlign: "center", padding: "0 16px", textShadow: "0 2px 20px rgba(0,0,0,0.3)", letterSpacing: "-0.03em" }}>
              {post.imageText}
            </div>
          </div>
        )}
        {post.kind === "youtube" && (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${post.ytThumb?.[0] ?? "#0A0A0A"}, ${post.ytThumb?.[1] ?? "#1A1A1A"})`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
          }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderTop: "12px solid transparent", borderBottom: "12px solid transparent", borderLeft: "20px solid white", marginLeft: 4 }} />
            </div>
            <div style={{ color: "white", fontSize: 13, fontWeight: 600, textAlign: "center", padding: "0 16px", opacity: 0.9 }}>{post.ytTitle}</div>
          </div>
        )}
        {post.kind === "text" && (
          <div style={{
            width: "100%", height: "100%",
            background: `${communityColor}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1D1D1F", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 6 }}>
              {post.text}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
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
