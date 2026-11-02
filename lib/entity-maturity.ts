import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  loadSongGlobalStatsFromSnapshots,
  lookupSongGlobal100Stats,
} from "@/lib/global-snapshot";
import {
  buildAlbumPath,
  buildArtistPath,
  buildSongPath,
  parseAlbumSlug,
  parseArtistSlug,
  parseSongSlug,
} from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import {
  QUALITY_THRESHOLDS,
  isAlbumMature,
  isArtistMature,
  isProfileMature,
  isSongMature,
  robotsForMaturity,
} from "@/lib/content-quality";
import { releaseTypeLabel } from "@/lib/release-type";
import type { Locale } from "@/lib/i18n/config";

/**
 * Dados de maturidade das páginas de entidade (música/álbum/artista), usados em
 * generateMetadata (robots + canonical) e no sitemap. Mesmo critério de
 * lib/content-quality.ts que decide AdSense.
 */

/** Snapshots do Global carregados uma vez por request (página + metadata). */
export const getSongGlobalStats = cache(loadSongGlobalStatsFromSnapshots);

const PUBLISHED_PRIMARY = { isPublished: true, parada: { isPrimary: true } } as const;

async function distinctChartUsers(entryFilter: object): Promise<number> {
  const rows = await prisma.chart.findMany({
    where: { ...PUBLISHED_PRIMARY, entries: { some: entryFilter } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}

export type EntityMaturity = {
  mature: boolean;
  canonicalPath: string;
  title: string;
  description: string;
};

export const getSongMaturity = cache(async (slug: string, locale: Locale): Promise<EntityMaturity | null> => {
  const parsed = parseSongSlug(slug);
  if (!parsed) return null;
  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) return null;
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true, title: true, artist: true, spotifyId: true, artistRef: { select: { id: true } } },
  });
  if (!song) return null;

  const [uniqueUsers, globalStats] = await Promise.all([
    distinctChartUsers({ songId }),
    getSongGlobalStats(),
  ]);
  const gs = lookupSongGlobal100Stats(song, globalStats);
  const mature = isSongMature({ uniqueUsers, weeksTop100: gs.weeks });
  const en = locale === "en";
  return {
    mature,
    canonicalPath: buildSongPath({
      title: song.title,
      artist: song.artist,
      id: song.id,
      artistId: song.artistRef?.id,
      spotifyId: song.spotifyId,
    }),
    title: `${song.title} — ${song.artist} | ChartFM`,
    description: en
      ? `${song.title} by ${song.artist} on ChartFM: ${uniqueUsers} users charted it` +
        (gs.weeks > 0 ? `, ${gs.weeks} weeks on the Global 100 (peak #${gs.peak}).` : ".")
      : `${song.title}, de ${song.artist}, no ChartFM: ${uniqueUsers} usuários colocaram nas paradas` +
        (gs.weeks > 0 ? `, ${gs.weeks} semanas no Global 100 (pico #${gs.peak}).` : "."),
  };
});

export const getAlbumMaturity = cache(async (slug: string, locale: Locale): Promise<EntityMaturity | null> => {
  const parsed = parseAlbumSlug(slug);
  // Só a URL canônica por ids pode ser indexada; slugs textuais são ambíguos.
  if (!parsed || parsed.type !== "artistAlbumIds") return null;
  const album = await prisma.album.findUnique({
    where: { id: parsed.albumId },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      albumType: true,
      artist: { select: { id: true, name: true } },
      songs: { select: { title: true, artist: true, spotifyId: true } },
    },
  });
  if (!album || album.artist.id !== parsed.artistId) return null;

  const [ratingsCount, textReviewsCount, uniqueUsers, globalStats] = await Promise.all([
    prisma.albumReview.count({ where: { albumId: album.id } }),
    prisma.albumReview.count({ where: { albumId: album.id, body: { not: null }, NOT: { body: "" } } }),
    distinctChartUsers({ song: { albumRef: { id: album.id } } }),
    getSongGlobalStats(),
  ]);
  const weeksTop100 = album.songs.reduce(
    (max, s) => Math.max(max, lookupSongGlobal100Stats(s, globalStats).weeks),
    0,
  );
  const mature = isAlbumMature({ ratingsCount, textReviewsCount, uniqueUsers, weeksTop100 });
  const name = album.exhibitionName?.trim() || album.title;
  const typeLabel = releaseTypeLabel(album.albumType, locale);
  const en = locale === "en";
  return {
    mature,
    canonicalPath: buildAlbumPath(name, album.artist.name, { artistId: album.artist.id, albumId: album.id }),
    title: `${name} — ${album.artist.name} (${typeLabel}) | ChartFM`,
    description: en
      ? `${typeLabel} by ${album.artist.name}: ${ratingsCount} community ratings and ${uniqueUsers} users charting its tracks on ChartFM.`
      : `${typeLabel} de ${album.artist.name}: ${ratingsCount} avaliações da comunidade e ${uniqueUsers} usuários com faixas nas paradas do ChartFM.`,
  };
});

export const getArtistMaturity = cache(async (slugParam: string, locale: Locale): Promise<EntityMaturity | null> => {
  const parsed = parseArtistSlug(slugParam);
  const artist = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, name: true, exhibitionName: true, spotifyId: true },
  });
  if (!artist) return null;

  const [uniqueUsers, songsCharted, textReviewsCount] = await Promise.all([
    distinctChartUsers({ song: { artistSpotifyId: artist.spotifyId } }),
    prisma.song.count({
      where: { artistSpotifyId: artist.spotifyId, entries: { some: { chart: PUBLISHED_PRIMARY } } },
    }),
    prisma.albumReview.count({
      where: { album: { artistSpotifyId: artist.spotifyId }, body: { not: null }, NOT: { body: "" } },
    }),
  ]);
  const mature = isArtistMature({ uniqueUsers, songsCharted, textReviewsCount });
  const name = artist.exhibitionName?.trim() || artist.name;
  const en = locale === "en";
  return {
    mature,
    canonicalPath: buildArtistPath(artist.name, artist.spotifyId, artist.id),
    title: `${name} | ChartFM`,
    description: en
      ? `${name} on ChartFM: ${songsCharted} songs on user charts, ${uniqueUsers} users and ${textReviewsCount} written reviews.`
      : `${name} no ChartFM: ${songsCharted} músicas nas paradas dos usuários, ${uniqueUsers} usuários e ${textReviewsCount} reviews escritas.`,
  };
});

/** Metadata padrão de entidade: index só quando madura; canonical sempre própria. */
export function entityMetadata(m: EntityMaturity | null, fallbackTitle: string): Metadata {
  if (!m) return { title: fallbackTitle, robots: { index: false, follow: true } };
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: m.canonicalPath },
    robots: robotsForMaturity(m.mature),
    openGraph: { title: m.title, description: m.description, url: m.canonicalPath },
  };
}

export const getProfileMaturity = cache(async (handle: string, locale: Locale): Promise<EntityMaturity | null> => {
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { handle: true, name: true, bio: true },
  });
  if (!user) return null;
  const publishedCharts = await prisma.chart.count({
    where: { isPublished: true, user: { handle } },
  });
  return {
    mature: isProfileMature({ publishedCharts }),
    canonicalPath: `/profile/${encodeURIComponent(user.handle)}`,
    title: `${user.name} (@${user.handle}) | ChartFM`,
    description:
      user.bio?.trim().slice(0, 200) ||
      (locale === "en"
        ? `${publishedCharts} charts published by @${user.handle} on ChartFM.`
        : `${publishedCharts} paradas publicadas por @${user.handle} no ChartFM.`),
  };
});

// ─── Sitemap ────────────────────────────────────────────────────────────────

type SitemapEntity = { path: string; lastModified?: Date };

const SITEMAP_LIMIT = 5000;

/** Músicas maduras: usuários distintos (SQL) + semanas no Global 100 (snapshots). */
export async function listMatureSongPaths(limit = SITEMAP_LIMIT): Promise<SitemapEntity[]> {
  const min = QUALITY_THRESHOLDS.song.minUniqueUsers;
  const rows = await prisma.$queryRaw<{ id: string; users: number }[]>`
    SELECT ce."songId" AS id, COUNT(DISTINCT c."userId")::int AS users
    FROM "ChartEntry" ce
    JOIN "Chart" c ON c.id = ce."chartId"
    JOIN paradas p ON p.id = c.parada_id
    WHERE c.is_published AND p.is_primary
    GROUP BY ce."songId"
    HAVING COUNT(DISTINCT c."userId") >= ${min}
    ORDER BY users DESC
    LIMIT ${limit}`;
  if (rows.length === 0) return [];
  const usersById = new Map(rows.map((r) => [r.id, r.users]));
  const [songs, globalStats] = await Promise.all([
    prisma.song.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, title: true, artist: true, spotifyId: true, createdAt: true, artistRef: { select: { id: true } } },
    }),
    getSongGlobalStats(),
  ]);
  return songs
    .filter((s) =>
      isSongMature({
        uniqueUsers: usersById.get(s.id) ?? 0,
        weeksTop100: lookupSongGlobal100Stats(s, globalStats).weeks,
      }),
    )
    .map((s) => ({
      path: buildSongPath({ title: s.title, artist: s.artist, id: s.id, artistId: s.artistRef?.id, spotifyId: s.spotifyId }),
      lastModified: s.createdAt,
    }));
}

export async function listMatureAlbumPaths(limit = SITEMAP_LIMIT): Promise<SitemapEntity[]> {
  const t = QUALITY_THRESHOLDS.album;
  const [userRows, reviewRows] = await Promise.all([
    prisma.$queryRaw<{ id: number; users: number }[]>`
      SELECT al.id AS id, COUNT(DISTINCT c."userId")::int AS users
      FROM albums al
      JOIN "Song" s ON s.album_spotify_id = al.spotify_id
      JOIN "ChartEntry" ce ON ce."songId" = s.id
      JOIN "Chart" c ON c.id = ce."chartId"
      JOIN paradas p ON p.id = c.parada_id
      WHERE c.is_published AND p.is_primary
      GROUP BY al.id
      HAVING COUNT(DISTINCT c."userId") >= ${t.minUniqueUsers}
      LIMIT ${limit}`,
    prisma.$queryRaw<{ id: number; ratings: number; texts: number }[]>`
      SELECT r.album_id AS id, COUNT(*)::int AS ratings,
        COUNT(*) FILTER (WHERE r.body IS NOT NULL AND btrim(r.body) <> '')::int AS texts
      FROM album_reviews r
      GROUP BY r.album_id
      HAVING COUNT(*) >= ${t.minRatings}
      LIMIT ${limit}`,
  ]);
  const usersById = new Map(userRows.map((r) => [r.id, r.users]));
  const reviewsById = new Map(reviewRows.map((r) => [r.id, r]));
  const ids = [...new Set([...usersById.keys(), ...reviewsById.keys()])];
  if (ids.length === 0) return [];
  const [albums, globalStats] = await Promise.all([
    prisma.album.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        updatedAt: true,
        artist: { select: { id: true, name: true } },
        songs: { select: { title: true, artist: true, spotifyId: true } },
      },
    }),
    getSongGlobalStats(),
  ]);
  return albums
    .filter((a) => {
      const rv = reviewsById.get(a.id);
      return isAlbumMature({
        ratingsCount: rv?.ratings ?? 0,
        textReviewsCount: rv?.texts ?? 0,
        uniqueUsers: usersById.get(a.id) ?? 0,
        weeksTop100: a.songs.reduce((m, s) => Math.max(m, lookupSongGlobal100Stats(s, globalStats).weeks), 0),
      });
    })
    .slice(0, limit)
    .map((a) => ({
      path: buildAlbumPath(a.exhibitionName?.trim() || a.title, a.artist.name, { artistId: a.artist.id, albumId: a.id }),
      lastModified: a.updatedAt,
    }));
}

export async function listMatureArtistPaths(limit = SITEMAP_LIMIT): Promise<SitemapEntity[]> {
  const t = QUALITY_THRESHOLDS.artist;
  const [chartRows, reviewRows] = await Promise.all([
    prisma.$queryRaw<{ sid: string; users: number; songs: number }[]>`
      SELECT s.artist_spotify_id AS sid, COUNT(DISTINCT c."userId")::int AS users, COUNT(DISTINCT s.id)::int AS songs
      FROM "Song" s
      JOIN "ChartEntry" ce ON ce."songId" = s.id
      JOIN "Chart" c ON c.id = ce."chartId"
      JOIN paradas p ON p.id = c.parada_id
      WHERE c.is_published AND p.is_primary AND s.artist_spotify_id IS NOT NULL
      GROUP BY s.artist_spotify_id
      HAVING COUNT(DISTINCT c."userId") >= ${t.minUniqueUsers} AND COUNT(DISTINCT s.id) >= ${t.minSongsCharted}
      LIMIT ${limit}`,
    prisma.$queryRaw<{ sid: string; texts: number }[]>`
      SELECT al.artist_spotify_id AS sid, COUNT(*)::int AS texts
      FROM album_reviews r JOIN albums al ON al.id = r.album_id
      WHERE r.body IS NOT NULL AND btrim(r.body) <> ''
      GROUP BY al.artist_spotify_id
      HAVING COUNT(*) >= ${t.minTextReviews}
      LIMIT ${limit}`,
  ]);
  const chartBySid = new Map(chartRows.map((r) => [r.sid, r]));
  const textsBySid = new Map(reviewRows.map((r) => [r.sid, r.texts]));
  const sids = [...new Set([...chartBySid.keys(), ...textsBySid.keys()])];
  if (sids.length === 0) return [];
  const artists = await prisma.artist.findMany({
    where: { spotifyId: { in: sids } },
    select: { id: true, name: true, spotifyId: true, updatedAt: true },
  });
  return artists
    .filter((a) => {
      const c = chartBySid.get(a.spotifyId);
      return isArtistMature({
        uniqueUsers: c?.users ?? 0,
        songsCharted: c?.songs ?? 0,
        textReviewsCount: textsBySid.get(a.spotifyId) ?? 0,
      });
    })
    .slice(0, limit)
    .map((a) => ({ path: buildArtistPath(a.name, a.spotifyId, a.id), lastModified: a.updatedAt }));
}

export async function listMatureProfilePaths(limit = SITEMAP_LIMIT): Promise<SitemapEntity[]> {
  const rows = await prisma.$queryRaw<{ handle: string; last: Date }[]>`
    SELECT u.handle AS handle, MAX(c."publishedAt") AS last
    FROM "Chart" c JOIN "User" u ON u.id = c."userId"
    WHERE c.is_published AND u.needs_handle = false
    GROUP BY u.handle
    HAVING COUNT(*) >= ${QUALITY_THRESHOLDS.profile.minPublishedCharts}
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ path: `/profile/${encodeURIComponent(r.handle)}`, lastModified: r.last }));
}
