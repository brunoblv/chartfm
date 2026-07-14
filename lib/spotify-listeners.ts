/**
 * Ouvintes mensais do Spotify — não exposto pela Web API oficial (lib/spotify-server.ts),
 * só existe na página pública do artista. Obtido por scraping leve e isolado aqui para
 * conter o raio de impacto caso o Spotify mude o HTML da página.
 *
 * Usar apenas no servidor.
 */

import { prisma } from "@/lib/prisma";

const MONTHLY_LISTENERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const SCRAPE_TIMEOUT_MS = 10000;

// Ex.: "Artist · 1,234,567 monthly listeners." (meta description em inglês).
const META_DESCRIPTION_PATTERN = /<meta\s+name="description"\s+content="[^"]*?([\d.,]+)\s+monthly listeners/i;
// Fallback: número embutido no estado JS inicial da página, ex. "monthlyListeners":1234567.
const EMBEDDED_STATE_PATTERN = /"monthlyListeners"\s*:\s*"?(\d+)"?/i;

function parseListenerCount(raw: string): number {
  return Number(raw.replace(/[.,]/g, ""));
}

/** Raspa open.spotify.com/artist/{id} em busca do número de ouvintes mensais. Retorna null se não conseguir. */
export async function scrapeSpotifyMonthlyListeners(spotifyId: string): Promise<number | null> {
  const id = spotifyId.trim();
  if (!id) return null;

  let res: Response;
  try {
    res = await fetch(`https://open.spotify.com/artist/${encodeURIComponent(id)}`, {
      headers: { "Accept-Language": "en" },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const html = await res.text();
  const metaMatch = html.match(META_DESCRIPTION_PATTERN);
  if (metaMatch) {
    const n = parseListenerCount(metaMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  const embeddedMatch = html.match(EMBEDDED_STATE_PATTERN);
  if (embeddedMatch) {
    const n = parseListenerCount(embeddedMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Ouvintes mensais com cache local (via Artist, quando existir no catálogo).
 * Artistas ainda não catalogados localmente são raspados sem persistir cache.
 */
export async function getArtistMonthlyListeners(spotifyId: string): Promise<number | null> {
  const id = spotifyId.trim();
  if (!id) return null;

  const localArtist = await prisma.artist.findUnique({
    where: { spotifyId: id },
    select: { id: true, monthlyListeners: true, monthlyListenersFetchedAt: true },
  });

  if (
    localArtist?.monthlyListenersFetchedAt &&
    Date.now() - localArtist.monthlyListenersFetchedAt.getTime() < MONTHLY_LISTENERS_CACHE_TTL_MS
  ) {
    return localArtist.monthlyListeners;
  }

  const listeners = await scrapeSpotifyMonthlyListeners(id);
  if (listeners == null) return null;

  if (localArtist) {
    await prisma.artist.update({
      where: { id: localArtist.id },
      data: { monthlyListeners: listeners, monthlyListenersFetchedAt: new Date() },
    });
  }

  return listeners;
}
