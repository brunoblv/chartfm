import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/music-routes";
import type { ParsedSongSlug } from "@/lib/music-routes";

/** Primeiro `_` separa slug do título do slug do artista (pós-spotifyId). */
function splitSlugSuffix(suffix: string): { titleSlug: string; artistSlug: string } | null {
  const i = suffix.indexOf("_");
  if (i <= 0 || i >= suffix.length - 1) return null;
  return { titleSlug: suffix.slice(0, i), artistSlug: suffix.slice(i + 1) };
}

export async function resolveSongByTitleArtistSlugs(
  titleSlug: string,
  artistSlug: string,
  options?: { scanPoolFallback?: boolean },
): Promise<string | null> {
  const firstArtistWord = artistSlug.split("-").find((w) => w.length > 0) ?? artistSlug;
  const candidates = await prisma.song.findMany({
    where: { artist: { contains: firstArtistWord, mode: "insensitive" } },
    select: { id: true, title: true, artist: true },
  });
  const match = candidates.find(
    (s) => slugify(s.title) === titleSlug && slugify(s.artist) === artistSlug,
  );
  if (match) return match.id;

  if (!options?.scanPoolFallback) return null;

  const pool = await prisma.song.findMany({
    select: { id: true, title: true, artist: true },
    take: 12000,
    orderBy: { id: "asc" },
  });
  return pool.find((s) => slugify(s.title) === titleSlug && slugify(s.artist) === artistSlug)?.id ?? null;
}

/**
 * Traduz slug de URL → id interno da `Song`.
 * Para formato spotify+sufixo: se o id Spotify apontar para outra faixa que não casa com o sufixo, prefere resolver pelo sufixo (caso típico: id “emprestado” + URL montada como buildSongPath).
 */
export async function resolveSongIdFromParsed(parsed: ParsedSongSlug): Promise<string | null> {
  if (parsed.type === "artistSongIds") {
    const song = await prisma.song.findFirst({
      where: { id: parsed.songId, artistRef: { id: parsed.artistId } },
      select: { id: true },
    });
    if (song?.id) return song.id;
    const fallback = await prisma.song.findUnique({ where: { id: parsed.songId }, select: { id: true } });
    return fallback?.id ?? null;
  }
  if (parsed.type === "internalId") {
    const song = await prisma.song.findUnique({
      where: { id: parsed.songId },
      select: { id: true },
    });
    if (song?.id) return song.id;
    const entry = await prisma.chartEntry.findUnique({
      where: { id: parsed.songId },
      select: { songId: true },
    });
    return entry?.songId ?? null;
  }
  if (parsed.type === "spotify") {
    const parts = parsed.slugSuffix ? splitSlugSuffix(parsed.slugSuffix) : null;

    const bySpotify = await prisma.song.findUnique({
      where: { spotifyId: parsed.spotifyId },
      select: { id: true, title: true, artist: true },
    });

    if (bySpotify && parts) {
      const slugOk =
        slugify(bySpotify.title) === parts.titleSlug && slugify(bySpotify.artist) === parts.artistSlug;
      if (slugOk) return bySpotify.id;

      const bySlug = await resolveSongByTitleArtistSlugs(parts.titleSlug, parts.artistSlug, {
        scanPoolFallback: true,
      });
      if (bySlug) return bySlug;
      return bySpotify.id;
    }

    if (bySpotify) return bySpotify.id;

    if (parts) {
      const bySlug = await resolveSongByTitleArtistSlugs(parts.titleSlug, parts.artistSlug, {
        scanPoolFallback: true,
      });
      if (bySlug) return bySlug;
    }
    return null;
  }

  return resolveSongByTitleArtistSlugs(parsed.titleSlug, parsed.artistSlug, { scanPoolFallback: true });
}
