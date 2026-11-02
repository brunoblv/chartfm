import type { MetadataRoute } from "next";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { prisma } from "@/lib/prisma";
import {
  listMatureAlbumPaths,
  listMatureArtistPaths,
  listMatureProfilePaths,
  listMatureSongPaths,
} from "@/lib/entity-maturity";

const COMMUNITY_LIMIT = 2000;

// Gerado sob demanda (consulta o banco) e revalidado a cada 6h.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://chartfm.com.br";
  const now = new Date();
  const editorialPosts = (await getEditorialPicksSorted()).map((pick) => ({
    url: `${base}/editorial/${pick.slug}`,
    lastModified: new Date(pick.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Entidades entram no sitemap pelo MESMO critério que libera index,follow na
  // página (lib/content-quality.ts) — sitemap e robots nunca podem divergir.
  const [artists, albums, songs, profiles, communities] = await Promise.all([
    listMatureArtistPaths(),
    listMatureAlbumPaths(),
    listMatureSongPaths(),
    listMatureProfilePaths(),
    prisma.community.findMany({
      where: { isPublic: true, posts: { gt: 0 } },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: COMMUNITY_LIMIT,
    }),
  ]);

  const toEntry = (priority: number) => (e: { path: string; lastModified?: Date }) => ({
    url: `${base}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "weekly" as const,
    priority,
  });
  const artistEntries = artists.map(toEntry(0.6));
  const albumEntries = albums.map(toEntry(0.55));
  const songEntries = songs.map(toEntry(0.55));
  const profileEntries = profiles.map(toEntry(0.5));

  const communityEntries = communities.map((community) => ({
    url: `${base}/community/${community.slug}`,
    lastModified: community.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
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
    { url: `${base}/data-deletion`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms-of-use`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/whats-new`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/ajuda`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/guides/como-criar-sua-parada`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-funciona-o-global-100`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/glossario`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-importar-historico`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-descobrir-musicas`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-participar-de-comunidades`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-funciona-a-copa`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-avaliar-albuns`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guides/como-funciona-a-pontuacao`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/editorial`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    ...editorialPosts,
    ...artistEntries,
    ...albumEntries,
    ...songEntries,
    ...profileEntries,
    ...communityEntries,
  ];
}
