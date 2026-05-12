import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import { AlbumType } from "@prisma/client";
import { AlbumsBrowseClient } from "./AlbumsBrowseClient";

export const revalidate = 60;

export type AlbumRow = {
  id: number;
  title: string;
  artist: string;
  artistId: number | null;
  genres: string[];
  albumType: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  totalTracks: number | null;
  score: number;
  userScore: number;
  reviewCount: number;
  ratingCount: number;
};

export default async function AlbumsPage() {
  const [albums, reviewGroups] = await Promise.all([
    prisma.album.findMany({
      where: { albumType: { in: [AlbumType.ALBUM, AlbumType.EP] } },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        albumType: true,
        artistSpotifyId: true,
        releaseDate: true,
        coverUrl: true,
        totalTracks: true,
        artist: {
          select: { id: true, name: true, exhibitionName: true, genres: true },
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.albumReview.groupBy({
      by: ["albumId"],
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  const statsMap = new Map(
    reviewGroups.map((s) => [s.albumId, { avg: Math.round(s._avg.rating ?? 0), count: s._count.id }]),
  );

  const rows: AlbumRow[] = albums.map((a) => {
    const stats = statsMap.get(a.id);
    return {
      id: a.id,
      title: a.exhibitionName || a.title,
      artist: a.artist.exhibitionName || a.artist.name,
      artistId: a.artist.id,
      genres: a.artist.genres,
      albumType: a.albumType,
      releaseDate: a.releaseDate?.toISOString().slice(0, 10) ?? null,
      coverUrl: a.coverUrl,
      totalTracks: a.totalTracks,
      score: stats?.avg ?? 0,
      userScore: stats?.avg ?? 0,
      reviewCount: stats?.count ?? 0,
      ratingCount: a._count.reviews,
    };
  });

  return (
    <Shell title="Álbuns" subtitle="Avaliações e reviews pela comunidade ChartFM">
      <AlbumsBrowseClient albums={rows} />
    </Shell>
  );
}
