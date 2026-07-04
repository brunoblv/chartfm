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

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca músicas para o editor de singles da Copa: catálogo local (com spotifyId)
 * + busca ao vivo no Spotify, no mesmo padrão de duas fases usado por useSpotifySearch
 * na Parada. Só retorna músicas do artista selecionado — as singles da Copa são
 * sempre do próprio artista. Nunca retorna texto livre — só resultados reais de busca.
 */
export async function searchCopaSongs(query: string, artistName: string): Promise<CopaSongSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  let dbTracks: CopaSongSearchResult[] = [];
  let accessToken: string | null = null;
  let configured = true;

  try {
    const res = await fetch(
      `/api/spotify/search?q=${encodeURIComponent(q)}&artist=${encodeURIComponent(artistName)}&limit=10`,
      { cache: "no-store" },
    );
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
    const fieldQuery = `${q} artist:"${artistName}"`;
    const sres = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(fieldQuery)}&type=track&limit=10&market=BR`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!sres.ok) return dbTracks;
    const sjson = (await sres.json()) as { tracks?: { items?: SpotifyDirectTrackItem[] } };
    const items = sjson.tracks?.items ?? [];

    // O filtro artist: do Spotify é fuzzy — confirma que o artista selecionado
    // está mesmo entre os artistas da faixa antes de exibir.
    const target = normalizeName(artistName);
    const seen = new Set(dbTracks.map((t) => t.spotifyId).filter((id): id is string => Boolean(id)));
    const merged = [...dbTracks];
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      if (!item.artists?.some((a) => normalizeName(a.name) === target)) continue;
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
