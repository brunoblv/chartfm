export type CopaSongSearchResult = {
  id: string | null;
  title: string;
  artist: string;
  spotifyId: string | null;
};

type SpotifySearchResponse = {
  tracks?: Array<{ spotifyId: string; title: string; artist: string }>;
  configured?: boolean;
  accessToken?: string | null;
};

type SpotifyDirectTrackItem = {
  id: string;
  name: string;
  artists?: Array<{ name: string }>;
};

/**
 * Busca músicas para o editor de singles da Copa: catálogo local (com spotifyId)
 * + busca ao vivo no Spotify, no mesmo padrão de duas fases usado por useSpotifySearch
 * na Parada. Nunca retorna texto livre — só resultados reais de busca.
 */
export async function searchCopaSongs(query: string, artistName: string): Promise<CopaSongSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const combined = `${q} ${artistName}`.trim();

  let dbTracks: CopaSongSearchResult[] = [];
  let accessToken: string | null = null;
  let configured = true;

  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(combined)}&limit=10`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as SpotifySearchResponse;
    dbTracks = (json.tracks ?? []).map((t) => ({
      id: null,
      title: t.title,
      artist: t.artist,
      spotifyId: t.spotifyId,
    }));
    accessToken = json.accessToken ?? null;
    configured = json.configured !== false;
  } catch {
    return [];
  }

  if (!accessToken || !configured) return dbTracks;

  try {
    const sres = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(combined)}&type=track&limit=10&market=BR`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!sres.ok) return dbTracks;
    const sjson = (await sres.json()) as { tracks?: { items?: SpotifyDirectTrackItem[] } };
    const items = sjson.tracks?.items ?? [];

    const seen = new Set(dbTracks.map((t) => t.spotifyId).filter((id): id is string => Boolean(id)));
    const merged = [...dbTracks];
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push({
        id: null,
        title: item.name,
        artist: item.artists?.map((a) => a.name).join(", ") || artistName,
        spotifyId: item.id,
      });
      if (merged.length >= 10) break;
    }
    return merged;
  } catch {
    return dbTracks;
  }
}
