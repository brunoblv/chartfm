import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import { buildAlbumPath } from "@/lib/music-routes";
import { scoreColor, scoreBg, scoreLabel } from "@/lib/album-score";
import { getSpotifyAlbumDetails } from "@/lib/spotify-server";
import { AlbumReviewsClient } from "./AlbumReviewsClient";

export const revalidate = 60;

export default async function CriticsFMAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId: rawId } = await params;
  const albumId = parseInt(rawId, 10);
  if (isNaN(albumId)) notFound();

  const session = await getServerSession(authOptions);

  const [album, reviewStats, initialReviews] = await Promise.all([
    prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        coverUrl: true,
        releaseDate: true,
        albumType: true,
        totalTracks: true,
        spotifyId: true,
        spotifyUrl: true,
        label: true,
        artist: {
          select: { id: true, name: true, exhibitionName: true, genres: true },
        },
      },
    }),
    prisma.albumReview.aggregate({
      where: { albumId },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.albumReview.findMany({
      where: { albumId },
      orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        rating: true,
        body: true,
        helpful: true,
        createdAt: true,
        user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
      },
    }),
  ]);

  if (!album) notFound();

  const likedReviewIds = new Set(
    session?.user?.id && initialReviews.length > 0
      ? (
          await prisma.albumReviewHelpful.findMany({
            where: {
              userId: session.user.id,
              reviewId: { in: initialReviews.map((r) => r.id) },
            },
            select: { reviewId: true },
          })
        ).map((v) => v.reviewId)
      : [],
  );

  const albumTitle = album.exhibitionName || album.title;
  const artistName = album.artist.exhibitionName || album.artist.name;

  const label = album.label ?? null;
  if (label === null && album.spotifyId) {
    const spotifyId = album.spotifyId;
    getSpotifyAlbumDetails(spotifyId)
      .then((d) => d?.label ? prisma.album.update({ where: { id: albumId }, data: { label: d.label } }) : null)
      .catch(() => {});
  }

  const avgScore = reviewStats._avg.rating ? Math.round(reviewStats._avg.rating) : 0;
  const reviewCount = reviewStats._count.id;
  const albumHref = buildAlbumPath(albumTitle, artistName, {
    artistId: album.artist.id,
    albumId: album.id,
  });

  return (
    <Shell title="" noPadding>
      {/* Header */}
      <div className="cfm-album-header">
        <Link
          href="/criticsfm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-muted)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={15} />
          CriticsFM
        </Link>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Cover */}
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={albumTitle}
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                objectFit: "cover",
                flexShrink: 0,
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                background: "var(--fill-inset)",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 32,
                fontWeight: 800,
                color: "var(--text-disabled)",
              }}
            >
              {albumTitle[0]?.toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "var(--text)",
                    lineHeight: 1.1,
                    marginBottom: 6,
                  }}
                >
                  {albumTitle}
                </div>
                <Link
                  href={`/artist/${album.artist.id}`}
                  style={{ fontSize: 16, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
                >
                  {artistName}
                </Link>
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {album.releaseDate && (
                    <span style={{ fontSize: 13, color: "var(--text-disabled)" }}>
                      {album.releaseDate.getFullYear()}
                    </span>
                  )}
                  {album.albumType && (
                    <span style={{ fontSize: 13, color: "var(--text-disabled)" }}>
                      {album.albumType === "ALBUM" ? "LP" : album.albumType}
                    </span>
                  )}
                  <Link
                    href={albumHref}
                    style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                  >
                    Ver nas paradas →
                  </Link>
                </div>
              </div>

              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: reviewCount > 0 ? scoreBg(avgScore) : "rgba(0,0,0,0.04)",
                    color: reviewCount > 0 ? scoreColor(avgScore) : "#AEAEB2",
                    display: "grid",
                    placeItems: "center",
                    fontSize: reviewCount > 0 ? 30 : 22,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    border: reviewCount > 0 ? `2px solid ${scoreColor(avgScore)}30` : "2px solid rgba(0,0,0,0.08)",
                  }}
                >
                  {reviewCount > 0 ? avgScore : "-"}
                </div>
                <div>
                  {reviewCount > 0 && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor(avgScore) }}>
                      {scoreLabel(avgScore)}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {reviewCount > 0
                      ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
                      : "Sem avaliações"}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                      marginTop: 4,
                    }}
                  >
                    CriticsFM
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="cfm-album-body">
        <AlbumReviewsClient
          albumDbId={albumId}
          albumTitle={albumTitle}
          albumArtist={artistName}
          albumCoverUrl={album.coverUrl ?? null}
          initialAvgScore={avgScore}
          initialReviewCount={reviewCount}
          initialReviews={initialReviews.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            likedByMe: likedReviewIds.has(r.id),
          }))}
          albumDetails={{
            releaseDate: album.releaseDate?.toISOString().slice(0, 10) ?? null,
            albumType: album.albumType ?? null,
            totalTracks: album.totalTracks ?? null,
            genres: album.artist.genres,
            spotifyUrl: album.spotifyUrl ?? null,
            label,
          }}
        />
      </div>
    </Shell>
  );
}
