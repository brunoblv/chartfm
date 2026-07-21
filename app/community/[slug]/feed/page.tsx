"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Heart, MessageCircle, Repeat2, Share, ChevronUp, ChevronDown, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { POSTS, POST_REPLIES, COMMUNITIES, USERS_DATA } from "@/lib/data";
import { useTranslations } from "@/hooks/useTranslations";

export default function ImmersiveFeedPage({ params }: { params: { slug: string } }) {
  const { t } = useTranslations();
  const community = COMMUNITIES.find((c) => c.slug === params.slug) ?? COMMUNITIES[0];
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState("");
  const [feedMode, setFeedMode] = useState<"foryou" | "following">("foryou");

  const posts = POSTS;
  const post = posts[idx % posts.length];

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(posts.length - 1, i + 1));

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isLiked = liked.has(post.id);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "white", overflow: "hidden" }}>
      {/* Main column */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "20px 24px",
          background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Link href={`/community/${params.slug}`} style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", textDecoration: "none",
          }}>
            <ChevronLeft size={20} />
          </Link>

          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${community.cover[0]}, ${community.cover[1]})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {community.icon}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t("communities.feedImmersiveLabel")}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{community.name}</div>
          </div>

          {/* Feed toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 100, padding: 3, gap: 2 }}>
            {(["foryou", "following"] as const).map((mode) => (
              <button key={mode} onClick={() => setFeedMode(mode)} style={{
                padding: "6px 14px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                background: feedMode === mode ? "white" : "transparent",
                color: feedMode === mode ? "#1D1D1F" : "rgba(255,255,255,0.7)",
              }}>
                {mode === "foryou" ? t("communities.feedForYou") : t("communities.feedFollowing")}
              </button>
            ))}
          </div>
        </div>

        {/* Post media container */}
        <div style={{ width: 460, aspectRatio: "9/16", position: "relative", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <PostMedia post={post} />

          {/* Bottom overlay */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
            padding: "40px 20px 20px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar user={post.user} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{post.user.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>@{post.user.handle} · {post.postedAgo}</div>
              </div>
              <button style={{ background: "white", color: "#1D1D1F", border: "none", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700 }}>
                {t("communities.followCta")}
              </button>
            </div>
            <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>{post.text}</p>
          </div>
        </div>

        {/* Side actions */}
        <div style={{
          position: "absolute",
          right: "calc(50% - 260px)",
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}>
          {[
            { icon: <Heart size={22} fill={isLiked ? "white" : "none"} />, label: isLiked ? post.likes + 1 : post.likes, action: () => toggleLike(post.id) },
            { icon: <MessageCircle size={22} />, label: post.replies, action: undefined },
            { icon: <Repeat2 size={22} />, label: post.shares, action: undefined },
            { icon: <Share size={22} />, label: t("recommendations.shareButton"), action: undefined },
          ].map(({ icon, label, action }, i) => (
            <button
              key={i}
              onClick={action}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
                width: 48, height: 48, borderRadius: "50%",
                color: "white", cursor: "pointer",
                justifyContent: "center",
              }}
            >
              {icon}
            </button>
          ))}
          <div style={{
            width: 40, height: 40, borderRadius: 10, border: "2px solid white",
            background: `linear-gradient(135deg, ${community.cover[0]}, ${community.cover[1]})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {community.icon}
          </div>
        </div>

        {/* Nav up/down */}
        <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: <ChevronUp size={20} />, action: prev, disabled: idx === 0 },
            { icon: <ChevronDown size={20} />, action: next, disabled: idx >= posts.length - 1 },
          ].map(({ icon, action, disabled }, i) => (
            <button key={i} onClick={action} disabled={disabled} style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: disabled ? "rgba(255,255,255,0.3)" : "white", cursor: disabled ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Replies panel */}
      <div style={{ width: 380, background: "#0F0F0F", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t("communities.feedRepliesTitle")}</div>
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 2 }}>{t("recommendations.replyCount", { count: post.replies })}</div>
        </div>

        {/* Replies list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {POST_REPLIES.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <Avatar user={r.user} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{r.user.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.4 }}>{r.time}</span>
                </div>
                <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>{r.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", display: "flex", gap: 4, alignItems: "center" }}>
                    <Heart size={12} /> {r.likes}
                  </button>
                  <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
                    {t("communities.replyCta")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compose footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar user={USERS_DATA[0]} size={32} />
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 100,
            padding: "8px 14px", display: "flex", alignItems: "center",
          }}>
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t("communities.feedReplyPlaceholder")}
              style={{ border: "none", background: "transparent", outline: "none", color: "white", fontSize: 13, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 18 }}>
            {["😂", "❤️", "🔥"].map((e) => (
              <button key={e} style={{ background: "none", border: "none", cursor: "pointer" }}>{e}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostMedia({ post }: { post: (typeof POSTS)[0] }) {
  if (post.kind === "image") {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: `linear-gradient(135deg, ${post.imagePalette?.[0] ?? "#FA243C"}, ${post.imagePalette?.[1] ?? "#FF5858"})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontSize: 72, fontWeight: 900, color: "white",
          textAlign: "center", padding: "0 24px",
          textShadow: "0 4px 40px rgba(0,0,0,0.4)",
          letterSpacing: "-0.045em", lineHeight: 1,
        }}>
          {post.imageText}
        </div>
      </div>
    );
  }

  if (post.kind === "youtube") {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: `linear-gradient(135deg, ${post.ytThumb?.[0] ?? "#0A0A0A"}, ${post.ytThumb?.[1] ?? "#1A1A1A"})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
        position: "relative",
      }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderTop: "18px solid transparent", borderBottom: "18px solid transparent", borderLeft: "30px solid white", marginLeft: 6 }} />
        </div>
        <div style={{ color: "white", fontSize: 18, fontWeight: 700, textAlign: "center", padding: "0 24px", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          {post.ytTitle}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>
          {post.ytChannel}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(135deg, #FA243C22, #FF585808)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#1D1D1F", lineHeight: 1.5, textAlign: "center" }}>
        {post.text}
      </div>
    </div>
  );
}
