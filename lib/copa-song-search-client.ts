export type CopaSongSearchResult = {
  id: string | null;
  title: string;
  artist: string;
  spotifyId: string | null;
};

type SpotifySearchResponse = {
  tracks?: Array<{ spotifyId: string; title: string; artist: string }>;
  configured?: boolean;
};

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Remove releases duplicados: o mesmo título (normalizado) aparece uma vez só.
 * Versões distintas (remix, radio edit, live…) têm títulos diferentes e
 * continuam todas na lista.
 */
export function dedupeExactTitles(
  tracks: CopaSongSearchResult[],
  max: number,
): CopaSongSearchResult[] {
  const seen = new Set<string>();
  const out: CopaSongSearchResult[] = [];
  for (const t of tracks) {
    const key = normalizeName(t.title).replace(/[^a-z0-9]+/g, " ").trim() || t.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Busca músicas para o editor de singles da Copa, sempre restrita ao artista
 * selecionado. Primeiro o catálogo local; só consulta o Spotify quando o banco
 * não encontrou nada. Releases idênticos são deduplicados; versões distintas
 * (remix, radio edit…) aparecem todas. Nunca retorna texto livre.
 */
export const COPA_SONG_SEARCH_MIN_CHARS = 3;

export async function searchCopaSongs(query: string, artistName: string): Promise<CopaSongSearchResult[]> {
  const q = query.trim();
  if (q.length < COPA_SONG_SEARCH_MIN_CHARS) return [];

  try {
    // O backend resolve tudo: catálogo local primeiro e, se vazio, Spotify pelo
    // servidor com `q artist:"nome"` (cache compartilhado + dedup — sem token no browser).
    const res = await fetch(
      `/api/spotify/search?q=${encodeURIComponent(q)}&artist=${encodeURIComponent(artistName)}&limit=20`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as SpotifySearchResponse;

    // O filtro artist: do Spotify é fuzzy — confirma que o artista selecionado
    // está mesmo entre os artistas da faixa antes de exibir.
    const target = normalizeName(artistName);
    const results: CopaSongSearchResult[] = [];
    for (const t of json.tracks ?? []) {
      if (!t.spotifyId) continue;
      const artistNames = t.artist.split(",").map((a) => normalizeName(a));
      if (!artistNames.some((a) => a === target || a.includes(target) || target.includes(a))) continue;
      results.push({
        id: null,
        title: t.title,
        artist: t.artist,
        spotifyId: t.spotifyId,
      });
    }
    return dedupeExactTitles(results, 20);
  } catch {
    return [];
  }
}
