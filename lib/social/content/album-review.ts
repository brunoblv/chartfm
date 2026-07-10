import { prisma } from "@/lib/prisma";
import type { ReviewCardInput } from "@/lib/social/review-card";
import { scoreLabel } from "@/lib/album-score";
import { buildVariedAlbumNarrative } from "@/lib/social/content/caption-variety";

export type AlbumReviewContent = {
  albumId: number;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  reviewCount: number;
  targetUrl: string;
  narrativeLine: string;
};

const ALBUM_TYPE_LABEL: Record<string, string> = {
  ALBUM: "álbum",
  SINGLE: "single",
  EP: "EP",
  COMPILATION: "álbum",
};

/** Busca dados reais do álbum + nota da comunidade (mesmo cálculo de lib/criticsfm-data.ts) — nunca inventa dados. */
export async function loadAlbumReviewContent(albumId: number, kind: "ALBUM_REVIEW_MILESTONE" | "ALBUM_CLUB_WINNER" = "ALBUM_REVIEW_MILESTONE"): Promise<AlbumReviewContent | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      coverUrl: true,
      releaseDate: true,
      totalTracks: true,
      label: true,
      albumType: true,
      artist: { select: { name: true, exhibitionName: true } },
    },
  });
  if (!album) return null;

  const agg = await prisma.albumReview.aggregate({
    where: { albumId },
    _avg: { rating: true },
    _count: { id: true },
  });
  const reviewCount = agg._count.id;
  if (reviewCount < 2) return null;

  const rating = Math.round(agg._avg.rating ?? 0);
  const albumTitle = album.exhibitionName || album.title;
  const albumArtist = album.artist.exhibitionName || album.artist.name;
  const daysSinceRelease = album.releaseDate ? Math.floor((Date.now() - album.releaseDate.getTime()) / 86_400_000) : null;

  const narrativeLine = buildVariedAlbumNarrative(
    {
      albumTitle,
      albumArtist,
      rating,
      reviewCount,
      scoreLabelText: scoreLabel(rating),
      albumTypeLabel: album.albumType ? ALBUM_TYPE_LABEL[album.albumType] ?? null : null,
      totalTracks: album.totalTracks,
      label: album.label,
      daysSinceRelease,
    },
    kind,
  );

  return {
    albumId: album.id,
    albumTitle,
    albumArtist,
    albumCoverUrl: album.coverUrl,
    rating,
    reviewCount,
    targetUrl: `/criticsfm/${album.id}`,
    narrativeLine,
  };
}

export function toReviewCardInput(content: AlbumReviewContent): ReviewCardInput {
  return {
    albumTitle: content.albumTitle,
    albumArtist: content.albumArtist,
    albumCoverUrl: content.albumCoverUrl,
    rating: content.rating,
    reviewCount: content.reviewCount,
  };
}
