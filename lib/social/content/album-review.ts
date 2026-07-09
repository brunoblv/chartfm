import { prisma } from "@/lib/prisma";
import type { ReviewCardInput } from "@/lib/social/review-card";

export type AlbumReviewContent = {
  albumId: number;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  reviewCount: number;
  targetUrl: string;
};

/** Busca dados reais do álbum + nota da comunidade (mesmo cálculo de lib/criticsfm-data.ts) — nunca inventa dados. */
export async function loadAlbumReviewContent(albumId: number): Promise<AlbumReviewContent | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, exhibitionName: true, coverUrl: true, artist: { select: { name: true, exhibitionName: true } } },
  });
  if (!album) return null;

  const agg = await prisma.albumReview.aggregate({
    where: { albumId },
    _avg: { rating: true },
    _count: { id: true },
  });
  const reviewCount = agg._count.id;
  if (reviewCount < 2) return null;

  return {
    albumId: album.id,
    albumTitle: album.exhibitionName || album.title,
    albumArtist: album.artist.exhibitionName || album.artist.name,
    albumCoverUrl: album.coverUrl,
    rating: Math.round(agg._avg.rating ?? 0),
    reviewCount,
    targetUrl: `/criticsfm/${album.id}`,
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
