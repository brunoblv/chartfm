import { prisma } from "@/lib/prisma";
import { AlbumType } from "@prisma/client";

export type CriticsFMAlbum = {
  id: number;
  title: string;
  artist: string;
  artistId: number | null;
  genres: string[];
  albumType: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  score: number;
  reviewCount: number;
};

export async function getCriticsFMAlbums(): Promise<CriticsFMAlbum[]> {
  const [albums, reviewGroups] = await Promise.all([
    prisma.album.findMany({
      where: { albumType: { in: [AlbumType.ALBUM, AlbumType.EP] } },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        albumType: true,
        releaseDate: true,
        coverUrl: true,
        artist: {
          select: { id: true, name: true, exhibitionName: true, genres: true },
        },
      },
      orderBy: { createdAt: "desc" },
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

  return albums.map((a) => {
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
      score: stats?.avg ?? 0,
      reviewCount: stats?.count ?? 0,
    };
  });
}

// Catálogo completo fica só na memória do servidor (TTL curto) — nunca no HTML.
const CATALOG_TTL_MS = 60_000;
let catalogCache: { at: number; data: Promise<CriticsFMAlbum[]> } | null = null;

export function getCriticsFMCatalog(): Promise<CriticsFMAlbum[]> {
  const now = Date.now();
  if (!catalogCache || now - catalogCache.at > CATALOG_TTL_MS) {
    const data = getCriticsFMAlbums();
    catalogCache = { at: now, data };
    data.catch(() => {
      if (catalogCache?.data === data) catalogCache = null;
    });
  }
  return catalogCache.data;
}

export function getTopRatedAlbums(albums: CriticsFMAlbum[], limit = 12): CriticsFMAlbum[] {
  return albums
    .filter((a) => a.reviewCount >= 2)
    .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount)
    .slice(0, limit);
}
