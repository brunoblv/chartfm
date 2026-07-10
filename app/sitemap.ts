import type { MetadataRoute } from "next";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { prisma } from "@/lib/prisma";
import { buildArtistPath, buildAlbumPath, buildSongPath } from "@/lib/music-routes";

// Limites por entidade para manter o sitemap dentro do teto de 50.000 URLs do Next
// e evitar indexar em massa páginas sem conteúdo suficiente (thin content).
const ARTIST_LIMIT = 5000;
const ALBUM_LIMIT = 3000;
const SONG_LIMIT = 5000;
const COMMUNITY_LIMIT = 2000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://chartfm.com.br";
  const now = new Date();
  const editorialPosts = (await getEditorialPicksSorted()).map((pick) => ({
    url: `${base}/editorial/${pick.slug}`,
    lastModified: new Date(pick.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Só indexável se tiver conteúdo mínimo: artista com bio (Wikipedia), álbum com
  // avaliações da comunidade, música com aparição em alguma parada, comunidade
  // pública com atividade real.
  const [artists, albums, songs, communities] = await Promise.all([
    prisma.artist.findMany({
      where: { bio: { not: null } },
      select: { id: true, name: true, spotifyId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: ARTIST_LIMIT,
    }),
    prisma.album.findMany({
      where: { reviews: { some: {} } },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        artist: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: ALBUM_LIMIT,
    }),
    prisma.song.findMany({
      where: { entries: { some: {} } },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        createdAt: true,
        artistRef: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: SONG_LIMIT,
    }),
    prisma.community.findMany({
      where: { isPublic: true, posts: { gt: 0 } },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: COMMUNITY_LIMIT,
    }),
  ]);

  const artistEntries = artists.map((artist) => ({
    url: `${base}${buildArtistPath(artist.name, artist.spotifyId, artist.id)}`,
    lastModified: artist.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const albumEntries = albums.map((album) => ({
    url: `${base}${buildAlbumPath(album.title, album.artist.name, {
      artistId: album.artist.id,
      albumId: album.id,
    })}`,
    lastModified: album.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.55,
  }));

  const songEntries = songs.map((song) => ({
    url: `${base}${buildSongPath({
      title: song.title,
      artist: song.artist,
      id: song.id,
      artistId: song.artistRef?.id,
      spotifyId: song.spotifyId,
    })}`,
    lastModified: song.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.55,
  }));

  const communityEntries = communities.map((community) => ({
    url: `${base}/community/${community.slug}`,
    lastModified: community.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/global`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/global/100`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/global/airplay`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/global/albums`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/communities`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/albums`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/criticsfm`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms-of-use`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/whats-new`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/editorial`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    ...editorialPosts,
    ...artistEntries,
    ...albumEntries,
    ...songEntries,
    ...communityEntries,
  ];
}
