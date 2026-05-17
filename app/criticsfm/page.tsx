import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import { AlbumType } from "@prisma/client";
import { CriticsFMClient } from "./CriticsFMClient";

export const revalidate = 60;

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

export default async function CriticsFMPage() {
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

  const rows: CriticsFMAlbum[] = albums.map((a) => {
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

  return (
    <Shell title="CriticsFM" subtitle="CriticsFM reúne as avaliações da comunidade ChartFM em um único lugar. Descubra os álbuns mais bem avaliados da semana, leia reviews de outros usuários e compartilhe sua própria opinião sobre os lançamentos que estão movimentando o cenário musical. Cada nota contribui para o ranking coletivo da plataforma, criando uma visão da comunidade sobre os discos mais aclamados do momento.">
      <CriticsFMClient albums={rows} />
    </Shell>
  );
}
