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

// Contagem exata no label SSR: id="monthly-listeners-label">1,234,567 monthly listeners
const LABEL_PATTERN = /id="monthly-listeners-label"[^>]*>([\d.,\s]+)\s*monthly listeners/i;
// Meta/OG abreviado (formato atual): "Artist · 101.2M monthly listeners."
const META_ABBR_PATTERN =
  /<meta\s+name="description"\s+content="[^"]*?([\d.,]+)\s*([KMB])?\s*monthly listeners/i;
const OG_ABBR_PATTERN =
  /<meta\s+property="og:description"\s+content="[^"]*?([\d.,]+)\s*([KMB])?\s*monthly listeners/i;
// Número completo embutido em qualquer lugar do HTML.
const FULL_INLINE_PATTERN = /([\d,]{1,3}(?:,\d{3})+)\s+monthly listeners/i;
// Fallback legado: estado JS inicial, ex. "monthlyListeners":1234567.
const EMBEDDED_STATE_PATTERN = /"monthlyListeners"\s*:\s*"?(\d+)"?/i;

function parseListenerCount(raw: string, suffix?: string | null): number | null {
  const n = Number(String(raw).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[String(suffix || "").toUpperCase()] ?? 1;
  return Math.round(n * mult);
}

/** Raspa open.spotify.com/artist/{id} em busca do número de ouvintes mensais. Retorna null se não conseguir. */
export async function scrapeSpotifyMonthlyListeners(spotifyId: string): Promise<number | null> {
  const id = spotifyId.trim();
  if (!id) return null;

  let res: Response;
  try {
    res = await fetch(`https://open.spotify.com/artist/${encodeURIComponent(id)}`, {
      // Sem User-Agent de browser: o Spotify devolve o shell SPA sem os dados SSR.
      headers: {
        "Accept-Language": "en",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const html = await res.text();

  const labelMatch = html.match(LABEL_PATTERN);
  if (labelMatch) {
    const n = parseListenerCount(labelMatch[1]);
    if (n != null) return n;
  }

  const fullMatch = html.match(FULL_INLINE_PATTERN);
  if (fullMatch) {
    const n = parseListenerCount(fullMatch[1]);
    if (n != null) return n;
  }

  for (const pattern of [META_ABBR_PATTERN, OG_ABBR_PATTERN]) {
    const m = html.match(pattern);
    if (m) {
      const n = parseListenerCount(m[1], m[2]);
      if (n != null) return n;
    }
  }

  const embeddedMatch = html.match(EMBEDDED_STATE_PATTERN);
  if (embeddedMatch) {
    const n = parseListenerCount(embeddedMatch[1]);
    if (n != null) return n;
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

  // Só reutiliza cache com valor real — null em cache não deve bloquear o claim por 6h.
  if (
    localArtist?.monthlyListeners != null &&
    localArtist.monthlyListenersFetchedAt &&
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
