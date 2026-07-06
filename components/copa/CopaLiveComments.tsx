"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";

type CopaLiveCommentUser = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
};

type CopaLiveCommentRow = {
  id: string;
  text: string;
  likes: number;
  liked: boolean;
  createdAt: string;
  user: CopaLiveCommentUser;
};

export function CopaLiveCommentsScrollButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 99,
        border: "1.5px solid var(--divider)",
        background: "var(--surface)",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <MessageCircle size={14} />
      {t("global.commentsToggleShow")}
    </button>
  );
}

export function CopaLiveCommentsPanel({
  copaId,
  batchOrder,
  style,
}: {
  copaId: string;
  batchOrder: number | null;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslations();
  const { data: session } = useSession();
  const [comments, setComments] = useState<CopaLiveCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const query = batchOrder != null ? `?batchOrder=${batchOrder}` : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/copa/${copaId}/live-comments${query}`)
      .then((r) => r.json())
      .then((data: CopaLiveCommentRow[]) => {
        if (!cancelled) setComments(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [copaId, query]);

  async function submitComment() {
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/copa/${copaId}/live-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, batchOrder }),
      });
      if (res.ok) {
        const created = (await res.json()) as CopaLiveCommentRow;
        setComments((prev) => [created, ...prev]);
        setText("");
      } else if (res.status === 401) {
        alert(t("chart.loginToComment"));
      } else {
        alert(t("chart.commentSubmitError"));
      }
    } catch {
      alert(t("chart.connectionError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(commentId: string) {
    if (!session?.user) {
      alert(t("chart.loginToLike"));
      return;
    }
    const res = await fetch(`/api/copa/${copaId}/live-comments/${commentId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { liked: boolean; likes: number };
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, liked: data.liked, likes: data.likes } : c)),
    );
  }

  return (
    <div
      id="copa-live-comments"
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        overflow: "hidden",
        marginTop: 20,
        ...style,
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {loading ? t("global.commentsTitle") : t("global.commentsTitleCount", { count: comments.length })}
        </div>
      </div>
      <div style={{ overflowY: "auto", maxHeight: 500 }}>
        {loading ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>
            {t("chart.loadingComments")}
          </div>
        ) : comments.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>
            {t("chart.noComments")}
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--divider-soft)",
                display: "flex",
                gap: 10,
              }}
            >
              <Avatar user={{ name: c.user.name, avatar: c.user.avatarColor }} imageUrl={c.user.image} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 5, alignItems: "baseline", marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{c.user.name}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text)" }}>{c.text}</div>
                <button
                  onClick={() => toggleLike(c.id)}
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: 12,
                    color: c.liked ? "var(--accent)" : "var(--text-muted)",
                    fontFamily: "inherit",
                  }}
                >
                  <Heart size={12} fill={c.liked ? "currentColor" : "none"} />
                  {c.likes}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--divider)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          }}
          placeholder={t("global.commentsPlaceholder")}
          style={{
            flex: 1,
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 13,
            lineHeight: 1.45,
            background: "var(--fill-inset)",
            color: "var(--text)",
            outline: "none",
            fontFamily: "inherit",
            resize: "none",
            minHeight: 36,
            maxHeight: 120,
            overflowY: "auto",
          }}
        />
        <button
          onClick={submitComment}
          disabled={submitting || !text.trim()}
          style={{
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 100,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: submitting || !text.trim() ? "default" : "pointer",
            flexShrink: 0,
            opacity: submitting || !text.trim() ? 0.5 : 1,
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
