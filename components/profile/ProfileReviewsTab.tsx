"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Instagram, Trash2 } from "lucide-react";
import { scoreBg, scoreColor, scoreLabel } from "@/lib/album-score";
import { downloadReviewStory, downloadReviewTwitter } from "@/lib/review-story-export";

export type ProfileReview = {
  id: string;
  rating: number;
  body: string | null;
  helpful: number;
  createdAt: string;
  album: {
    id: number;
    title: string;
    coverUrl: string | null;
    artistName: string;
  };
};

type Props = {
  handle: string;
  isOwn: boolean;
  userName: string;
  isMobile?: boolean;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

export function ProfileReviewsTab({ handle, isOwn, userName, isMobile }: Props) {
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState<{ id: string; type: "story" | "twitter" } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const perPage = 12;

  const fetchReviews = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), perPage: String(perPage) });
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}/reviews?${q}`);
      if (!res.ok) return;
      const data = (await res.json()) as { reviews: ProfileReview[]; total: number; page: number };
      setReviews(data.reviews);
      setTotal(data.total);
      setPage(data.page);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    void fetchReviews(1);
  }, [fetchReviews]);

  const deleteReview = async (review: ProfileReview) => {
    if (!confirm("Excluir esta review?")) return;
    setDeletingId(review.id);
    try {
      const res = await fetch(`/api/albums/${review.album.id}/reviews/${review.id}`, { method: "DELETE" });
      if (!res.ok) return;
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setTotal((t) => Math.max(0, t - 1));
    } finally {
      setDeletingId(null);
    }
  };

  const exportImage = async (review: ProfileReview, type: "story" | "twitter") => {
    setExporting({ id: review.id, type });
    try {
      const payload = {
        albumTitle: review.album.title,
        albumArtist: review.album.artistName,
        albumCoverUrl: review.album.coverUrl,
        rating: review.rating,
        body: review.body,
        userName,
        userHandle: handle,
      };
      if (type === "story") await downloadReviewStory(payload);
      else await downloadReviewTwitter(payload);
    } finally {
      setExporting(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (loading && reviews.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 15 }}>
        Carregando reviews…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
        <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
          {isOwn ? "Você ainda não avaliou nenhum álbum" : "Nenhuma review publicada ainda"}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: isOwn ? 20 : 0 }}>
          {isOwn ? "Explore álbuns no CriticsFM e compartilhe sua opinião." : "Quando houver reviews elas aparecerão aqui."}
        </p>
        {isOwn && (
          <Link href="/criticsfm" style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
            Ir para o CriticsFM →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{total}</span> review{total === 1 ? "" : "s"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {reviews.map((review) => {
          const truncated =
            review.body && review.body.length > 280 ? `${review.body.slice(0, 280)}…` : review.body;
          return (
            <article
              key={review.id}
              style={{
                background: "var(--surface)",
                borderRadius: 18,
                border: "1px solid var(--divider)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: "18px 20px 14px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Link href={`/criticsfm/${review.album.id}`} style={{ flexShrink: 0, lineHeight: 0 }}>
                  {review.album.coverUrl ? (
                    <img
                      src={review.album.coverUrl}
                      alt={review.album.title}
                      width={72}
                      height={72}
                      style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 10, background: "var(--fill-subtle)" }} />
                  )}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/criticsfm/${review.album.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {review.album.title}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {review.album.artistName}
                    </div>
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{timeAgo(review.createdAt)}</div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: scoreBg(review.rating),
                    color: scoreColor(review.rating),
                    display: "grid",
                    placeItems: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {review.rating}
                </div>
              </div>

              <div style={{ padding: "0 20px 12px", fontSize: 12, fontWeight: 600, color: scoreColor(review.rating) }}>
                {scoreLabel(review.rating)}
              </div>

              {truncated ? (
                <div style={{ padding: "0 20px 16px", fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.55, flex: 1 }}>
                  {truncated}
                </div>
              ) : (
                <div style={{ padding: "0 20px 16px", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Apenas nota, sem texto
                </div>
              )}

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--divider-soft)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={`/criticsfm/${review.album.id}`}
                  style={{ fontSize: 13, color: "#FA243C", fontWeight: 600, textDecoration: "none", marginRight: "auto" }}
                >
                  Ver álbum →
                </Link>
                {isOwn && (
                  <>
                    <button
                      type="button"
                      onClick={() => exportImage(review, "story")}
                      disabled={exporting?.id === review.id}
                      style={actionBtnStyle}
                      title="Baixar imagem para story do Instagram"
                    >
                      <Instagram size={15} />
                      {exporting?.id === review.id && exporting.type === "story" ? "Baixando…" : "Story"}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportImage(review, "twitter")}
                      disabled={exporting?.id === review.id}
                      style={actionBtnStyle}
                      title="Baixar imagem para post no X (Twitter)"
                    >
                      <IconX size={14} />
                      {exporting?.id === review.id && exporting.type === "twitter" ? "Baixando…" : "X"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReview(review)}
                      disabled={deletingId === review.id}
                      style={{ ...actionBtnStyle, color: "#C5291C" }}
                      title="Excluir review"
                    >
                      <Trash2 size={15} />
                      {deletingId === review.id ? "…" : "Excluir"}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => fetchReviews(page - 1)}
            style={pageBtnStyle}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)", alignSelf: "center", padding: "0 8px" }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => fetchReviews(page + 1)}
            style={pageBtnStyle}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 100,
  border: "1px solid var(--divider-strong)",
  background: "var(--fill-subtle)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text)",
  cursor: "pointer",
};

const pageBtnStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
