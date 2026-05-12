"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";
import { scoreColor, scoreBg, scoreLabel, buildScoreDistribution } from "@/lib/album-score";

type ReviewUser = { id: string; handle: string; name: string; avatarColor: string; image: string | null };

type Review = {
  id: string;
  rating: number;
  body: string | null;
  helpful: number;
  createdAt: string;
  user: ReviewUser;
};

type AlbumDetails = {
  releaseDate: string | null;
  albumType: string | null;
  totalTracks: number | null;
  genres: string[];
  spotifyUrl: string | null;
  label: string | null;
};

type Props = {
  albumDbId: number;
  albumTitle: string;
  albumArtist: string;
  initialAvgScore: number;
  initialReviewCount: number;
  albumDetails: AlbumDetails;
};

export function AlbumReviewsClient({
  albumDbId,
  albumTitle,
  albumArtist,
  initialAvgScore,
  initialReviewCount,
  albumDetails,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sort, setSort] = useState<"helpful" | "recent">("helpful");
  const [avgScore, setAvgScore] = useState(initialAvgScore);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [scoreDistribution, setScoreDistribution] = useState<number[]>(new Array(10).fill(0));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/albums/${albumDbId}/reviews`);
        if (!res.ok) return;
        const data: Review[] = await res.json();
        setReviews(data);
        setLoaded(true);
        if (data.length > 0) {
          setAvgScore(Math.round(data.reduce((s, r) => s + r.rating, 0) / data.length));
          setReviewCount(data.length);
          setScoreDistribution(buildScoreDistribution(data.map((r) => r.rating)));
        }
      } catch {
        setLoaded(true);
      }
    })();
  }, [albumDbId]);

  const sorted =
    sort === "helpful"
      ? [...reviews].sort((a, b) => b.helpful - a.helpful)
      : [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const onReviewSubmitted = (newReview: Review) => {
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.user.id === newReview.user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newReview;
        return copy;
      }
      return [newReview, ...prev];
    });
    setReviewCount((c) => {
      const alreadyExists = reviews.some((r) => r.user.id === newReview.user.id);
      return alreadyExists ? c : c + 1;
    });
    setLoaded(true);
  };

  const maxDist = Math.max(...scoreDistribution, 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 32, alignItems: "flex-start" }}>
      {/* Main column */}
      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Reviews{reviewCount > 0 ? ` (${reviewCount})` : ""}
          </div>
          <div style={{ flex: 1 }} />
          {reviews.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "rgba(0,0,0,0.04)",
                padding: 3,
                borderRadius: 10,
              }}
            >
              {(["helpful", "recent"] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    background: sort === id ? "white" : "transparent",
                    color: sort === id ? "#1D1D1F" : "#86868B",
                    cursor: "pointer",
                    boxShadow: sort === id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {id === "helpful" ? "Mais úteis" : "Recentes"}
                </button>
              ))}
            </div>
          )}
        </div>

        <InlineReviewForm albumDbId={albumDbId} albumTitle={albumTitle} onSubmitted={onReviewSubmitted} />

        {!loaded ? (
          <div style={{ textAlign: "center", padding: 40, color: "#86868B", fontSize: 14 }}>
            Carregando reviews…
          </div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.06)",
              padding: 48,
              textAlign: "center",
              color: "#86868B",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Seja o primeiro a escrever uma review
            </div>
            <div style={{ fontSize: 14 }}>Compartilhe sua opinião sobre {albumTitle}</div>
          </div>
        ) : (
          <div
            style={{
              background: "white",
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.06)",
              padding: "4px 24px",
            }}
          >
            {sorted.map((rev) => (
              <ReviewCard
                key={rev.id}
                review={rev}
                albumDbId={albumDbId}
                onDeleted={(id) => {
                  setReviews((prev) => prev.filter((r) => r.id !== id));
                  setReviewCount((c) => Math.max(0, c - 1));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Score summary */}
        <div
          style={{
            background: "white",
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.06)",
            padding: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#86868B", marginBottom: 14 }}>
            Score CriticsFM
          </div>
          {reviewCount > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: scoreBg(avgScore),
                    color: scoreColor(avgScore),
                    display: "grid",
                    placeItems: "center",
                    fontSize: 28,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {avgScore}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor(avgScore), letterSpacing: "-0.01em" }}>
                    {scoreLabel(avgScore)}
                  </div>
                  <div style={{ fontSize: 12, color: "#86868B", marginTop: 3 }}>
                    {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                  </div>
                </div>
              </div>

              {/* Score distribution */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                {[...scoreDistribution].reverse().map((count, i) => {
                  const bucket = 9 - i;
                  const label = `${bucket * 10}–${bucket * 10 + 9}`;
                  const pct = (count / maxDist) * 100;
                  const bucketScore = bucket * 10 + 5;
                  return (
                    <div key={bucket} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: "#86868B",
                          width: 32,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 10,
                          background: "rgba(0,0,0,0.04)",
                          borderRadius: 5,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: scoreColor(bucketScore),
                            borderRadius: 5,
                            opacity: 0.8,
                            minWidth: count > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 9, color: "#86868B", width: 20, fontVariantNumeric: "tabular-nums" }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category breakdown */}
              {[
                ["Positivas (75–100)", reviews.filter((r) => r.rating >= 75).length, "#1B873F"],
                ["Mistas (50–74)", reviews.filter((r) => r.rating >= 50 && r.rating < 75).length, "#E09F00"],
                ["Negativas (0–49)", reviews.filter((r) => r.rating < 50).length, "#C5291C"],
              ].map(([label, count, color]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: color as string,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, fontSize: 11, color: "#1D1D1F" }}>{label as string}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {count as number}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "rgba(0,0,0,0.04)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#AEAEB2",
                  flexShrink: 0,
                }}
              >
                —
              </div>
              <div style={{ fontSize: 13, color: "#86868B" }}>Sem avaliações ainda</div>
            </div>
          )}
        </div>

        {/* Album Details */}
        <AlbumDetailsCard details={albumDetails} />
      </div>
    </div>
  );
}

// ——— Album Details Card ———
function AlbumDetailsCard({ details }: { details: AlbumDetails }) {
  const formatDate = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  };

  const formatType = (t: string | null) => {
    if (!t) return null;
    if (t === "ALBUM") return "LP";
    if (t === "EP") return "EP";
    if (t === "SINGLE") return "Single";
    if (t === "COMPILATION") return "Compilação";
    return t;
  };

  const rows: { value: string; key: string }[] = [];

  if (details.releaseDate) {
    rows.push({ value: formatDate(details.releaseDate), key: "data de lançamento" });
  }
  const fmt = formatType(details.albumType);
  if (fmt) rows.push({ value: fmt, key: "formato" });
  if (details.totalTracks) rows.push({ value: String(details.totalTracks), key: "faixas" });
  if (details.label) rows.push({ value: details.label, key: "gravadora" });
  if (details.genres.length > 0) {
    rows.push({ value: details.genres.slice(0, 3).join(", "), key: "gênero" });
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#86868B",
          marginBottom: 14,
        }}
      >
        Detalhes
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#AEAEB2" }}>Sem informações disponíveis</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {rows.map(({ value, key }) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                padding: "7px 0",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", flex: 1 }}>{value}</span>
              <span style={{ fontSize: 11, color: "#86868B", flexShrink: 0 }}>/ {key}</span>
            </div>
          ))}
        </div>
      )}

      {details.spotifyUrl && (
        <a
          href={details.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
            fontSize: 11,
            fontWeight: 700,
            color: "#1DB954",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          VER NO SPOTIFY
        </a>
      )}
    </div>
  );
}

// ——— Review Card ———
function ReviewCard({
  review,
  albumDbId,
  onDeleted,
}: {
  review: Review;
  albumDbId: number;
  onDeleted?: (id: string) => void;
}) {
  const { data: session } = useSession();
  const [helpful, setHelpful] = useState(review.helpful);
  const [voted, setVoted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = (session?.user as { id?: string } | undefined)?.id === review.user.id;

  const toggleHelpful = async () => {
    try {
      const res = await fetch(`/api/albums/${albumDbId}/reviews/${review.id}/helpful`, { method: "POST" });
      const data = (await res.json()) as { helpful: boolean };
      setHelpful((h) => h + (data.helpful ? 1 : -1));
      setVoted(data.helpful);
    } catch {
      // ignore
    }
  };

  const deleteReview = async () => {
    if (!confirm("Excluir sua review?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/albums/${albumDbId}/reviews/${review.id}`, { method: "DELETE" });
      onDeleted?.(review.id);
    } catch {
      setDeleting(false);
    }
  };

  const timeAgo = (() => {
    const d = new Date(review.createdAt);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "hoje";
    if (days === 1) return "ontem";
    if (days < 30) return `há ${days} dias`;
    const months = Math.floor(days / 30);
    return months === 1 ? "há 1 mês" : `há ${months} meses`;
  })();

  const isLong = (review.body?.length ?? 0) > 200;

  return (
    <div style={{ padding: "16px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: scoreBg(review.rating),
            color: scoreColor(review.rating),
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            border: `1.5px solid ${scoreColor(review.rating)}25`,
            flexShrink: 0,
          }}
        >
          {review.rating}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar
              user={{ name: review.user.name, avatar: review.user.avatarColor }}
              imageUrl={review.user.image}
              size={16}
            />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{review.user.name}</span>
            <span style={{ fontSize: 11, color: "#86868B" }}>· {timeAgo}</span>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={deleteReview}
            disabled={deleting}
            title="Excluir review"
            style={{
              background: "none",
              border: "none",
              padding: 4,
              color: "#86868B",
              cursor: deleting ? "not-allowed" : "pointer",
              fontSize: 14,
              lineHeight: 1,
              opacity: deleting ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            🗑
          </button>
        )}
      </div>

      {review.body && (
        <div style={{ marginTop: 10, marginLeft: 52 }}>
          {isLong && !expanded ? (
            <>
              <div style={{ fontSize: 14, color: "#1D1D1F", lineHeight: 1.55 }}>
                {review.body.slice(0, 200)}…
              </div>
              <button
                onClick={() => setExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#FA243C",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                Ler mais
              </button>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#1D1D1F", lineHeight: 1.55 }}>{review.body}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, marginLeft: 52 }}>
        <button
          onClick={toggleHelpful}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: voted ? "#FA243C" : "#86868B",
            fontSize: 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          👍 <span>Útil ({helpful})</span>
        </button>
      </div>
    </div>
  );
}

// ——— Inline Review Form ———
function InlineReviewForm({
  albumDbId,
  albumTitle,
  onSubmitted,
}: {
  albumDbId: number;
  albumTitle: string;
  onSubmitted: (r: Review) => void;
}) {
  const { data: session } = useSession();
  const [rating, setRating] = useState(70);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!session?.user) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "20px 24px",
          marginBottom: 20,
          textAlign: "center",
          color: "#86868B",
          fontSize: 14,
        }}
      >
        <span>
          <a href="/login" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            Entre
          </a>{" "}
          para escrever uma review
        </span>
      </div>
    );
  }

  const submit = async () => {
    if (body.trim().length > 0 && body.trim().length < 50) {
      setError("Se quiser escrever uma review, precisa ter pelo menos 50 caracteres.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/albums/${albumDbId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reviewBody: body.trim() || undefined }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Erro ao publicar.");
        return;
      }
      const apiReview = (await res.json()) as Omit<Review, "user">;
      const user = session.user as {
        id?: string;
        handle?: string;
        name?: string;
        avatarColor?: string;
        image?: string | null;
      };
      const fullReview: Review = {
        ...apiReview,
        user: {
          id: user.id ?? "",
          handle: user.handle ?? "",
          name: user.name ?? "Você",
          avatarColor: user.avatarColor ?? "#FA243C",
          image: user.image ?? null,
        },
      };
      setBody("");
      setRating(70);
      setError("");
      onSubmitted(fullReview);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const user = session.user as { name?: string; image?: string; avatarColor?: string } | undefined;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.08)",
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar
          user={{ name: user?.name ?? "", avatar: user?.avatarColor ?? "#ccc" }}
          imageUrl={user?.image ?? null}
          size={36}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", marginBottom: 6 }}>
            {user?.name ?? "Você"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              style={{ flex: 1, accentColor: scoreColor(rating) }}
            />
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: scoreBg(rating),
                color: scoreColor(rating),
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                border: `2px solid ${scoreColor(rating)}25`,
                flexShrink: 0,
              }}
            >
              {rating}
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor(rating), marginTop: 4 }}>
            {scoreLabel(rating)}
          </div>
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`O que achou de ${albumTitle}? Fale sobre produção, letras, faixas favoritas…`}
        rows={4}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.08)",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.55,
          boxSizing: "border-box",
          background: "#F5F5F7",
          color: "#1D1D1F",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ fontSize: 11, color: "#86868B" }}>
          {body.trim().length > 0
            ? `${body.length}/2000 · mínimo 50 caracteres`
            : "Review opcional"}
        </div>
        <button
          onClick={submit}
          disabled={submitting || (body.trim().length > 0 && body.trim().length < 50)}
          style={{
            background: "#FA243C",
            color: "white",
            border: "none",
            padding: "8px 20px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting || (body.trim().length > 0 && body.trim().length < 50) ? "not-allowed" : "pointer",
            opacity: body.trim().length > 0 && body.trim().length < 50 ? 0.45 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {submitting ? "Publicando…" : "Publicar"}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#C5291C",
            background: "#FDECEC",
            padding: "8px 12px",
            borderRadius: 8,
            marginTop: 10,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
