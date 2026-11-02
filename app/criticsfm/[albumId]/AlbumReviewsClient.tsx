"use client";

import { releaseTypeLabel } from "@/lib/release-type";
import { useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { Instagram, Pencil, Trash2, Heart } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Avatar } from "@/components/ui/Avatar";
import { SCORE_BANDS, SCORE_BAND_LABEL_KEYS, scoreColor, scoreBg, scoreLabel, aggregateScoreLabel, buildScoreDistribution } from "@/lib/album-score";
import { downloadReview, downloadAlbumScore, type ExportFormat } from "@/lib/review-story-export";
import { useTranslations } from "@/hooks/useTranslations";

type ReviewUser = { id: string; handle: string; name: string; avatarColor: string; image: string | null };

type Review = {
  id: string;
  rating: number;
  body: string | null;
  helpful: number;
  likedByMe?: boolean;
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
  albumCoverUrl: string | null;
  initialAvgScore: number;
  initialReviewCount: number;
  initialReviews: Review[];
  albumDetails: AlbumDetails;
};

function recomputeStats(allReviews: Review[]) {
  const count = allReviews.length;
  const avg = count > 0 ? Math.round(allReviews.reduce((s, r) => s + r.rating, 0) / count) : 0;
  const dist = count > 0 ? buildScoreDistribution(allReviews.map((r) => r.rating)) : new Array(10).fill(0);
  return { count, avg, dist };
}

export function AlbumReviewsClient({
  albumDbId,
  albumTitle,
  albumArtist,
  albumCoverUrl,
  initialAvgScore,
  initialReviewCount,
  initialReviews,
  albumDetails,
}: Props) {
  const { t, locale } = useTranslations();
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [sort, setSort] = useState<"likes" | "recent">("likes");
  const [avgScore, setAvgScore] = useState(initialAvgScore);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [scoreDistribution, setScoreDistribution] = useState<number[]>(
    initialReviews.length > 0
      ? buildScoreDistribution(initialReviews.map((r) => r.rating))
      : new Array(10).fill(0),
  );
  const [editing, setEditing] = useState(false);
  const isMobile = useIsMobile();

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const myReview = userId ? (reviews.find((r) => r.user.id === userId) ?? null) : null;

  const sorted =
    sort === "likes"
      ? [...reviews].sort((a, b) => b.helpful - a.helpful)
      : [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const othersReviews = userId ? sorted.filter((r) => r.user.id !== userId) : sorted;

  const applyReviews = (next: Review[]) => {
    const stats = recomputeStats(next);
    setReviews(next);
    setReviewCount(stats.count);
    setAvgScore(stats.avg);
    setScoreDistribution(stats.dist);
  };

  const onReviewSubmitted = (newReview: Review) => {
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.user.id === newReview.user.id);
      const next = idx >= 0 ? prev.map((r, i) => (i === idx ? newReview : r)) : [newReview, ...prev];
      const stats = recomputeStats(next);
      setReviewCount(stats.count);
      setAvgScore(stats.avg);
      setScoreDistribution(stats.dist);
      return next;
    });
    setEditing(false);
  };

  const onReviewDeleted = (id: string) => {
    applyReviews(reviews.filter((r) => r.id !== id));
    setEditing(false);
  };

  const maxDist = Math.max(...scoreDistribution, 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: isMobile ? 16 : 32, alignItems: "flex-start" }}>
      {/* Main column */}
      <div style={{ order: isMobile ? 2 : undefined }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
            {reviewCount > 0
              ? t("criticsfm.reviewsHeaderCount", { count: reviewCount })
              : t("criticsfm.reviewsHeader")}
          </div>
          <div style={{ flex: 1 }} />
          {reviews.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "var(--fill-inset)",
                padding: 3,
                borderRadius: 10,
              }}
            >
              {(["likes", "recent"] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    background: sort === id ? "var(--surface)" : "transparent",
                    color: sort === id ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer",
                    boxShadow: sort === id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {id === "likes" ? t("criticsfm.sortMostLiked") : t("criticsfm.sortRecent")}
                </button>
              ))}
            </div>
          )}
        </div>

        {myReview && !editing ? (
          <MyReviewCard
            review={myReview}
            albumDbId={albumDbId}
            albumTitle={albumTitle}
            albumArtist={albumArtist}
            albumCoverUrl={albumCoverUrl}
            onEdit={() => setEditing(true)}
            onDeleted={onReviewDeleted}
          />
        ) : (
          <InlineReviewForm
            albumDbId={albumDbId}
            albumTitle={albumTitle}
            initialRating={myReview?.rating}
            initialBody={myReview?.body ?? ""}
            onCancel={myReview ? () => setEditing(false) : undefined}
            onSubmitted={onReviewSubmitted}
          />
        )}

        {othersReviews.length === 0 ? (
          !myReview ? (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 18,
                border: "1px solid var(--divider)",
                padding: 48,
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {t("criticsfm.beFirstToReview")}
              </div>
              <div style={{ fontSize: 14 }}>{t("criticsfm.shareYourOpinion", { album: albumTitle })}</div>
            </div>
          ) : null
        ) : (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 18,
              border: "1px solid var(--divider)",
              padding: "4px 24px",
            }}
          >
            {othersReviews.map((rev) => (
              <ReviewCard
                key={rev.id}
                review={rev}
                albumDbId={albumDbId}
                onDeleted={onReviewDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ order: isMobile ? 1 : undefined, position: isMobile ? "static" : "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Score summary */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 18,
            border: "1px solid var(--divider)",
            padding: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
            {t("criticsfm.scoreCriticsFm")}
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
                    {aggregateScoreLabel(avgScore, reviewCount, locale)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    {t(
                      reviewCount === 1 ? "criticsfm.reviewCountSingular" : "criticsfm.reviewCountPlural",
                      { count: reviewCount },
                    )}
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
                          color: "var(--text-muted)",
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
                          background: "var(--fill-inset)",
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
                      <div style={{ fontSize: 9, color: "var(--text-muted)", width: 20, fontVariantNumeric: "tabular-nums" }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category breakdown */}
              {SCORE_BANDS.map((band) => {
                const count = reviews.filter((r) => r.rating >= band.min && r.rating <= band.max).length;
                return (
                  <div key={band.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: band.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, fontSize: 11, color: "var(--text)" }}>
                      {t(SCORE_BAND_LABEL_KEYS[band.id])} ({band.min}–{band.max})
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
                      {count}
                    </div>
                  </div>
                );
              })}

              <CommunityExportButtons
                albumTitle={albumTitle}
                albumArtist={albumArtist}
                albumCoverUrl={albumCoverUrl}
                rating={avgScore}
                reviewCount={reviewCount}
              />
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "var(--fill-inset)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "var(--text-disabled)",
                  flexShrink: 0,
                }}
              >
                -
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("criticsfm.noReviewsYet")}</div>
            </div>
          )}
        </div>

        {/* Album Details */}
        <AlbumDetailsCard details={albumDetails} />
      </div>
    </div>
  );
}

// ——— My Review Card ———
function MyReviewCard({
  review,
  albumDbId,
  albumTitle,
  albumArtist,
  albumCoverUrl,
  onEdit,
  onDeleted,
}: {
  review: Review;
  albumDbId: number;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t, locale } = useTranslations();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [expanded, setExpanded] = useState(false);

  const deleteReview = async () => {
    if (!confirm(t("criticsfm.confirmDeleteReview"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/albums/${albumDbId}/reviews/${review.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(review.id);
      else setDeleting(false);
    } catch {
      setDeleting(false);
    }
  };

  const exportImage = async (type: ExportFormat) => {
    setExporting(type);
    try {
      await downloadReview(
        {
          albumTitle,
          albumArtist,
          albumCoverUrl,
          rating: review.rating,
          body: review.body,
          userName: review.user.name,
          userHandle: review.user.handle,
        },
        type,
      );
    } finally {
      setExporting(null);
    }
  };

  const isLong = (review.body?.length ?? 0) > 280;

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
        {t("criticsfm.yourRatingLabel")}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: review.body ? 12 : 0 }}>
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
            fontVariantNumeric: "tabular-nums",
            border: `2px solid ${scoreColor(review.rating)}25`,
            flexShrink: 0,
          }}
        >
          {review.rating}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Avatar
              user={{ name: review.user.name, avatar: review.user.avatarColor }}
              imageUrl={review.user.image}
              size={20}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{review.user.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{review.user.handle}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: scoreColor(review.rating) }}>
            {scoreLabel(review.rating, locale)}
          </div>
        </div>
      </div>

      {review.body ? (
        <div style={{ marginBottom: 14 }}>
          {isLong && !expanded ? (
            <>
              <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>
                {review.body.slice(0, 280)}…
              </div>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                {t("criticsfm.readMore")}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>{review.body}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 14 }}>
          {t("criticsfm.ratedWithoutText")}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--divider-soft)" }}>
        <button type="button" onClick={onEdit} style={actionBtnStyle}>
          <Pencil size={14} />
          {t("criticsfm.editAction")}
        </button>
        <ExportFormatButtons exporting={exporting} onExport={exportImage} />
        <button
          type="button"
          onClick={deleteReview}
          disabled={deleting}
          style={{ ...actionBtnStyle, color: "#C5291C" }}
        >
          <Trash2 size={14} />
          {deleting ? "…" : t("criticsfm.deleteAction")}
        </button>
      </div>
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

function ExportFormatButtons({
  exporting,
  onExport,
}: {
  exporting: ExportFormat | null;
  onExport: (type: ExportFormat) => void;
}) {
  const { t } = useTranslations();
  return (
    <>
      <button type="button" onClick={() => onExport("story")} disabled={exporting !== null} style={actionBtnStyle} title={t("criticsfm.downloadStoryTitle")}>
        <Instagram size={14} />
        {exporting === "story" ? t("criticsfm.downloading") : t("criticsfm.storyLabel")}
      </button>
      <button type="button" onClick={() => onExport("square")} disabled={exporting !== null} style={actionBtnStyle} title={t("criticsfm.downloadSquareTitle")}>
        <Instagram size={14} />
        {exporting === "square" ? t("criticsfm.downloading") : t("criticsfm.squareLabel")}
      </button>
      <button type="button" onClick={() => onExport("twitter")} disabled={exporting !== null} style={actionBtnStyle} title={t("criticsfm.downloadTwitterTitle")}>
        <IconX size={13} />
        {exporting === "twitter" ? t("criticsfm.downloading") : "X"}
      </button>
    </>
  );
}

function CommunityExportButtons({
  albumTitle,
  albumArtist,
  albumCoverUrl,
  rating,
  reviewCount,
}: {
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  reviewCount: number;
}) {
  const { t } = useTranslations();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const exportImage = async (type: ExportFormat) => {
    setExporting(type);
    try {
      await downloadAlbumScore(
        { albumTitle, albumArtist, albumCoverUrl, rating, reviewCount },
        type,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--divider-soft)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
        {t("criticsfm.downloadCommunityScore")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ExportFormatButtons exporting={exporting} onExport={exportImage} />
      </div>
    </div>
  );
}

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ——— Album Details Card ———
function AlbumDetailsCard({ details }: { details: AlbumDetails }) {
  const { t, locale } = useTranslations();
  const formatDate = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  };

  const formatType = (albumType: string | null) => {
    if (!albumType) return null;
    return releaseTypeLabel(albumType, locale);
  };

  const rows: { value: string; key: string }[] = [];

  if (details.releaseDate) {
    rows.push({ value: formatDate(details.releaseDate), key: t("criticsfm.releaseDateLabel") });
  }
  const fmt = formatType(details.albumType);
  if (fmt) rows.push({ value: fmt, key: t("criticsfm.formatLabel") });
  if (details.totalTracks) rows.push({ value: String(details.totalTracks), key: t("criticsfm.tracksLabel") });
  if (details.label) rows.push({ value: details.label, key: t("criticsfm.labelLabel") });
  if (details.genres.length > 0) {
    rows.push({ value: details.genres.slice(0, 3).join(", "), key: t("criticsfm.genreLabel") });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 14,
        }}
      >
        {t("criticsfm.detailsLabel")}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-disabled)" }}>{t("criticsfm.noInfo")}</div>
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
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>{key}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{value}</span>
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
          {t("criticsfm.viewOnSpotify")}
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
  const { t } = useTranslations();
  const { data: session } = useSession();
  const [likes, setLikes] = useState(review.helpful);
  const [liked, setLiked] = useState(review.likedByMe ?? false);
  const [liking, setLiking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = (session?.user as { id?: string } | undefined)?.id === review.user.id;

  const toggleLike = async () => {
    if (liking) return;
    const prevLiked = liked;
    const prevCount = likes;
    setLiking(true);
    setLiked(!prevLiked);
    setLikes((c) => c + (prevLiked ? -1 : 1));
    try {
      const res = await fetch(`/api/albums/${albumDbId}/reviews/${review.id}/helpful`, { method: "POST" });
      if (!res.ok) throw new Error("like_failed");
      const data = (await res.json()) as { helpful?: boolean };
      if (typeof data.helpful === "boolean") setLiked(data.helpful);
    } catch {
      setLiked(prevLiked);
      setLikes(prevCount);
    } finally {
      setLiking(false);
    }
  };

  const deleteReview = async () => {
    if (!confirm(t("criticsfm.confirmDeleteReview"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/albums/${albumDbId}/reviews/${review.id}`, { method: "DELETE" });
      if (res.ok) onDeleted?.(review.id);
      else setDeleting(false);
    } catch {
      setDeleting(false);
    }
  };

  const timeAgo = (() => {
    const d = new Date(review.createdAt);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("criticsfm.timeToday");
    if (days === 1) return t("criticsfm.timeYesterday");
    if (days < 30) return t("criticsfm.timeDaysAgo", { days });
    const months = Math.floor(days / 30);
    return months === 1 ? t("criticsfm.timeOneMonthAgo") : t("criticsfm.timeMonthsAgo", { months });
  })();

  const isLong = (review.body?.length ?? 0) > 200;

  return (
    <div style={{ padding: "16px 0", borderBottom: "1px solid var(--divider)" }}>
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
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{review.user.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {timeAgo}</span>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={deleteReview}
            disabled={deleting}
            title={t("criticsfm.deleteReviewTitle")}
            style={{
              background: "none",
              border: "none",
              padding: 4,
              color: "var(--text-muted)",
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
              <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>
                {review.body.slice(0, 200)}…
              </div>
              <button
                onClick={() => setExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                {t("criticsfm.readMore")}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>{review.body}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, marginLeft: 52 }}>
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: liked ? "var(--accent)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: liking ? "default" : "pointer",
          }}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {likes > 0 && <span>{likes}</span>}
        </button>
      </div>
    </div>
  );
}

// ——— Inline Review Form ———
function InlineReviewForm({
  albumDbId,
  albumTitle,
  initialRating,
  initialBody,
  onCancel,
  onSubmitted,
}: {
  albumDbId: number;
  albumTitle: string;
  initialRating?: number;
  initialBody?: string;
  onCancel?: () => void;
  onSubmitted: (r: Review) => void;
}) {
  const { t, locale } = useTranslations();
  const { data: session } = useSession();
  const [rating, setRating] = useState(initialRating ?? 70);
  const [body, setBody] = useState(initialBody ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEditing = initialRating != null;

  if (!session?.user) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--divider)",
          padding: "20px 24px",
          marginBottom: 20,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        <span>
          <a href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            {t("criticsfm.signInLinkText")}
          </a>{" "}
          {t("criticsfm.signInSuffix")}
        </span>
      </div>
    );
  }

  const submit = async () => {
    if (body.trim().length > 0 && body.trim().length < 50) {
      setError(t("criticsfm.minCharsError"));
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
        setError(d.error ?? t("criticsfm.publishErrorFallback"));
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
        createdAt: apiReview.createdAt ?? new Date().toISOString(),
        user: {
          id: user.id ?? "",
          handle: user.handle ?? "",
          name: user.name ?? t("criticsfm.youFallback"),
          avatarColor: user.avatarColor ?? "#FA243C",
          image: user.image ?? null,
        },
      };
      onSubmitted(fullReview);
    } catch {
      setError(t("criticsfm.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  const user = session.user as { name?: string; image?: string; avatarColor?: string } | undefined;

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      {isEditing && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
          {t("criticsfm.editingYourReview")}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar
          user={{ name: user?.name ?? "", avatar: user?.avatarColor ?? "#ccc" }}
          imageUrl={user?.image ?? null}
          size={36}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            {user?.name ?? t("criticsfm.youFallback")}
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
            {scoreLabel(rating, locale)}
          </div>
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("criticsfm.reviewPlaceholderDetailed", { album: albumTitle })}
        rows={4}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--divider)",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.55,
          boxSizing: "border-box",
          background: "var(--fill-inset)",
          color: "var(--text)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {body.trim().length > 0
            ? t("criticsfm.charCountMin", { count: body.length })
            : t("criticsfm.reviewOptional")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{
                background: "var(--fill-subtle)",
                color: "var(--text)",
                border: "1px solid var(--divider)",
                padding: "8px 16px",
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {t("criticsfm.cancelAction")}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || (body.trim().length > 0 && body.trim().length < 50)}
            style={{
              background: "var(--accent)",
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
            {submitting
              ? t("criticsfm.savingAction")
              : isEditing
                ? t("criticsfm.saveAction")
                : t("criticsfm.publishAction")}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "var(--down-fg)",
            background: "var(--down-bg)",
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
