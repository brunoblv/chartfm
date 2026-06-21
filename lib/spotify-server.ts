/**
 * Integração com a Web API do Spotify (client credentials).
 * Usar apenas em Route Handlers / Server Components — nunca no bundle do cliente.
 */

const AUTH_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_RETRY_MAX_ATTEMPTS = 4;
const SPOTIFY_RETRY_BASE_DELAY_MS = 450;
const SPOTIFY_RETRY_MAX_DELAY_MS = 15000;

type SpotifyImage = { url: string; height: number | null; width: number | null };

type SpotifyTrackApi = {
  id: string;
  name: string;
  artists: { id: string; name: string; external_urls?: { spotify?: string } }[];
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
    album_type?: string;
    release_date?: string;
    total_tracks?: number;
    external_urls?: { spotify?: string };
  };
  external_urls: { spotify: string };
  preview_url: string | null;
  duration_ms?: number;
  track_number?: number;
};

type SpotifySearchJson = {
  tracks?: { items: SpotifyTrackApi[] };
};

const tokenState: { accessToken: string | null; expiresAt: number } = {
  accessToken: null,
  expiresAt: 0,
};

const coverCache = new Map<string, string | null>();
const COVER_CACHE_MAX = 500;

type SearchCacheEntry = { tracks: { spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null; previewUrl: string | null; externalUrl: string }[]; expiresAt: number };
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_MAX = 200;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return null;
}

const SPOTIFY_FETCH_TIMEOUT_MS = 10000;

async function spotifyFetch(
  input: string | URL,
  init: RequestInit,
  maxAttempts: number = SPOTIFY_RETRY_MAX_ATTEMPTS,
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    const timeoutSignal = AbortSignal.timeout(SPOTIFY_FETCH_TIMEOUT_MS);
    const mergedSignal =
      init.signal
        ? AbortSignal.any([init.signal as AbortSignal, timeoutSignal])
        : timeoutSignal;
    try {
      res = await fetch(input, { ...init, signal: mergedSignal });
    } catch {
      if (attempt >= maxAttempts) return null;
      await sleep(SPOTIFY_RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    if (res.status !== 429) return res;
    if (attempt >= maxAttempts) return res;

    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const delay = Math.min(
      SPOTIFY_RETRY_MAX_DELAY_MS,
      retryAfterMs ?? SPOTIFY_RETRY_BASE_DELAY_MS * attempt,
    );
    await sleep(delay);
  }
  return null;
}

function trimKey(artist: string, title: string) {
  return `${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function cacheSet(key: string, url: string | null) {
  if (coverCache.size >= COVER_CACHE_MAX) {
    const first = coverCache.keys().next().value;
    if (first !== undefined) coverCache.delete(first);
  }
  coverCache.set(key, url);
}

function searchCacheSet(key: string, tracks: SearchCacheEntry["tracks"]) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first !== undefined) searchCache.delete(first);
  }
  searchCache.set(key, { tracks, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

export function spotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (tokenState.accessToken && Date.now() < tokenState.expiresAt) {
    return tokenState.accessToken;
  }

  const res = await spotifyFetch(
    AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    },
    1, // 1 tentativa: falha rápido em vez de acumular retries longos
  );

  if (!res?.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenState.accessToken = data.access_token;
  tokenState.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return tokenState.accessToken;
}

export function pickAlbumImageUrl(images: SpotifyImage[] | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  const preferred = sorted.find((i) => (i.height ?? 0) >= 300) ?? sorted[0];
  return preferred?.url ?? null;
}

export function mapTrackToResult(track: SpotifyTrackApi) {
  const artist = track.artists.map((a) => a.name).join(", ");
  return {
    spotifyId: track.id,
    title: track.name,
    artist,
    album: track.album.name,
    imageUrl: pickAlbumImageUrl(track.album.images),
    previewUrl: track.preview_url,
    externalUrl: track.external_urls.spotify,
  };
}

// Tags que indicam versões não-originais de um álbum
const EDITION_PATTERN =
  /\b(deluxe|super\s+deluxe|special\s+edition|bonus\s+track|expanded|anniversary|remaster(?:ed)?|reissue|edition|re-?release)\b/i;

// Sufixos de faixa que devem ser ignorados ao agrupar versões do mesmo song
const TRACK_SUFFIX_PATTERN =
  /\s*[\-–—]\s*(remaster(?:ed)?|radio\s+edit|single\s+version|album\s+version|acoustic|demo|instrumental|live|mono|stereo)[^)]*$/i;
const TRACK_PAREN_PATTERN =
  /\s*\((?:remaster(?:ed)?|radio\s+edit|single\s+version|album\s+version|acoustic|demo|instrumental|live|mono|stereo)[^)]*\)/gi;

function canonicalSongKey(track: SpotifyTrackApi): string {
  const title = track.name
    .replace(TRACK_PAREN_PATTERN, "")
    .replace(TRACK_SUFFIX_PATTERN, "")
    .toLowerCase()
    .trim();
  const artist = (track.artists[0]?.name ?? "").toLowerCase().trim();
  return `${artist}|${title}`;
}

function sortReleaseMs(raw: string | undefined): number {
  if (!raw) return Infinity;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00Z`).getTime();
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00Z`).getTime();
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00Z`).getTime();
  return Infinity;
}

function pickBestVersion(tracks: SpotifyTrackApi[]): SpotifyTrackApi {
  return [...tracks].sort((a, b) => {
    const aEdition = EDITION_PATTERN.test(a.album.name) ? 1 : 0;
    const bEdition = EDITION_PATTERN.test(b.album.name) ? 1 : 0;
    if (aEdition !== bEdition) return aEdition - bEdition;
    return sortReleaseMs(a.album.release_date) - sortReleaseMs(b.album.release_date);
  })[0];
}

export async function searchSpotifyTracks(query: string, limit = 10, market: string = "BR", signal?: AbortSignal) {
  const q = query.trim();
  const lim = Math.min(50, Math.max(1, limit));
  const cacheKey = `${q}|${lim}|${market}`;

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.tracks;

  const token = await getAccessToken();
  if (!token) return [];

  if (signal?.aborted) return [];

  // Busca mais candidatos para ter opções suficientes após deduplicação
  const fetchLimit = Math.min(50, lim * 4);
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(fetchLimit));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
    signal,
  });

  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifySearchJson;
  const items = json.tracks?.items ?? [];

  // Agrupa por (título normalizado, artista principal) e escolhe a melhor versão:
  // sem tags de edição primeiro, depois a mais antiga
  const groups = new Map<string, SpotifyTrackApi[]>();
  for (const item of items) {
    const key = canonicalSongKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const tracks = [...groups.values()]
    .map(pickBestVersion)
    .slice(0, lim)
    .map(mapTrackToResult);

  searchCacheSet(cacheKey, tracks);
  return tracks;
}

export type SpotifyTrackMetadata = {
  spotifyId: string;
  title: string;
  artistDisplay: string;
  artists: { spotifyId: string; name: string; spotifyUrl?: string | null }[];
  primaryArtist: { spotifyId: string; name: string; spotifyUrl?: string | null } | null;
  featuredArtists: { spotifyId: string; name: string; spotifyUrl?: string | null }[];
  album: {
    spotifyId: string | null;
    title: string | null;
    coverUrl: string | null;
    albumType: "SINGLE" | "EP" | "ALBUM" | "COMPILATION" | null;
    releaseDate: Date | null;
    totalTracks: number | null;
    spotifyUrl: string | null;
  };
  previewUrl: string | null;
  spotifyUrl: string | null;
  durationMs: number | null;
  trackNumber: number | null;
};

function mapAlbumType(input: string | undefined): SpotifyTrackMetadata["album"]["albumType"] {
  if (!input) return null;
  const value = input.toUpperCase();
  if (value === "SINGLE" || value === "EP" || value === "ALBUM" || value === "COMPILATION") return value;
  return null;
}

function parseSpotifyReleaseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00.000Z`);
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00.000Z`);
  return null;
}

type SpotifyAlbumTracksPageJson = {
  items: { id: string; name: string }[];
  next: string | null;
};

/** IDs e títulos das faixas tal como listadas no álbum (evita “canonical” de outro relançamento). */
export async function listSpotifyAlbumTracks(
  albumSpotifyId: string,
  market: string = "MX",
): Promise<{ spotifyId: string; title: string }[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const aid = albumSpotifyId.trim();
  if (!aid) return [];

  const out: { spotifyId: string; title: string }[] = [];
  let url: string | null =
    `${API_BASE}/albums/${encodeURIComponent(aid)}/tracks?limit=50&market=${encodeURIComponent(market)}`;
  while (url) {
    const res = await spotifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (!res?.ok) break;
    const json = (await res.json()) as SpotifyAlbumTracksPageJson;
    for (const it of json.items ?? []) {
      if (it?.id && it?.name && !/instrumental/i.test(it.name)) out.push({ spotifyId: it.id, title: it.name });
    }
    url = json.next ?? null;
  }
  return out;
}

type SpotifyArtistAlbumsPageJson = {
  items: {
    id: string;
    name: string;
    album_type?: string;
    release_date?: string;
  }[];
  next: string | null;
};

export type SpotifyArtistAlbumRef = {
  spotifyId: string;
  name: string;
  albumType: string | null;
  releaseDate: string | null;
};

/** Álbuns/singles/compilações vinculados ao artista (GET /artists/{id}/albums, todas as páginas). */
export async function listSpotifyArtistAlbums(
  artistSpotifyId: string,
  market: string = "KR",
): Promise<SpotifyArtistAlbumRef[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const id = artistSpotifyId.trim();
  if (!id) return [];

  const includeGroups = ["album", "single", "appears_on", "compilation"].join(",");
  const out: SpotifyArtistAlbumRef[] = [];
  let url: string | null =
    `${API_BASE}/artists/${encodeURIComponent(id)}/albums?include_groups=${encodeURIComponent(includeGroups)}&market=${encodeURIComponent(market)}&limit=50`;

  while (url) {
    const res = await spotifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (!res?.ok) break;
    const json = (await res.json()) as SpotifyArtistAlbumsPageJson;
    for (const it of json.items ?? []) {
      if (it?.id && it?.name) {
        out.push({
          spotifyId: it.id,
          name: it.name,
          albumType: it.album_type ?? null,
          releaseDate: it.release_date ?? null,
        });
      }
    }
    url = json.next ?? null;
  }
  return out;
}

type SpotifyAlbumApi = {
  id: string;
  name: string;
  album_type?: string;
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  label?: string;
  external_urls?: { spotify?: string };
  artists?: { id: string; name: string }[];
};

export type SpotifyAlbumDetails = {
  spotifyId: string;
  title: string;
  coverUrl: string | null;
  albumType: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  spotifyUrl: string | null;
  label: string | null;
  artistSpotifyId: string | null;
  artistName: string | null;
};

/** Metadados do álbum (capa, datas) para alinhar com um `album_id` concreto no catálogo. */
export async function getSpotifyAlbumMetadataById(
  albumSpotifyId: string,
  market: string = "MX",
): Promise<SpotifyTrackMetadata["album"] | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = albumSpotifyId.trim();
  if (!id) return null;

  const res = await spotifyFetch(
    `${API_BASE}/albums/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
  );
  if (!res?.ok) return null;
  const a = (await res.json()) as SpotifyAlbumApi;
  if (!a?.id) return null;
  return {
    spotifyId: a.id,
    title: a.name,
    coverUrl: pickAlbumImageUrl(a.images),
    albumType: mapAlbumType(a.album_type),
    releaseDate: parseSpotifyReleaseDate(a.release_date),
    totalTracks: a.total_tracks ?? null,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

export async function getSpotifyAlbumDetails(
  albumSpotifyId: string,
  market: string = "BR",
): Promise<SpotifyAlbumDetails | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = albumSpotifyId.trim();
  if (!id) return null;

  const res = await spotifyFetch(
    `${API_BASE}/albums/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } },
  );
  if (!res?.ok) return null;
  const a = (await res.json()) as SpotifyAlbumApi;
  if (!a?.id) return null;
  const rd = parseSpotifyReleaseDate(a.release_date);
  return {
    spotifyId: a.id,
    title: a.name,
    coverUrl: pickAlbumImageUrl(a.images),
    albumType: mapAlbumType(a.album_type),
    releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
    totalTracks: a.total_tracks ?? null,
    spotifyUrl: a.external_urls?.spotify ?? null,
    label: a.label ?? null,
    artistSpotifyId: a.artists?.[0]?.id ?? null,
    artistName: a.artists?.[0]?.name ?? null,
  };
}

export async function getSpotifyTrackMetadataById(trackId: string, market: string = "BR"): Promise<SpotifyTrackMetadata | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = trackId.trim();
  if (!id) return null;

  const res = await spotifyFetch(`${API_BASE}/tracks/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res?.ok) return null;
  const track = (await res.json()) as SpotifyTrackApi;

  const artists = track.artists
    .filter((a) => Boolean(a.id))
    .map((a) => ({ spotifyId: a.id, name: a.name, spotifyUrl: a.external_urls?.spotify ?? null }));
  const primaryArtist = artists[0] ?? null;
  const featuredArtists = artists.slice(1);

  return {
    spotifyId: track.id,
    title: track.name,
    artistDisplay: track.artists.map((a) => a.name).join(", "),
    artists,
    primaryArtist,
    featuredArtists,
    album: {
      spotifyId: track.album?.id ?? null,
      title: track.album?.name ?? null,
      coverUrl: pickAlbumImageUrl(track.album?.images),
      albumType: mapAlbumType(track.album?.album_type),
      releaseDate: parseSpotifyReleaseDate(track.album?.release_date),
      totalTracks: track.album?.total_tracks ?? null,
      spotifyUrl: track.album?.external_urls?.spotify ?? null,
    },
    previewUrl: track.preview_url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? null,
    durationMs: track.duration_ms ?? null,
    trackNumber: track.track_number ?? null,
  };
}

type SpotifyArtistApi = {
  id: string;
  name: string;
  genres?: string[];
  images: SpotifyImage[];
  external_urls?: { spotify?: string };
};

export type SpotifyArtistProfile = {
  spotifyId: string;
  name: string;
  genres: string[];
  imageUrl: string | null;
  spotifyUrl: string | null;
};

function mapArtistApiToProfile(artist: SpotifyArtistApi): SpotifyArtistProfile {
  return {
    spotifyId: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    imageUrl: pickAlbumImageUrl(artist.images),
    spotifyUrl: artist.external_urls?.spotify ?? null,
  };
}

/** Perfil oficial do artista (GET /artists/{id}), incluindo fotos. */
export async function getSpotifyArtistById(spotifyId: string): Promise<SpotifyArtistProfile | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = spotifyId.trim();
  if (!id) return null;

  const res = await spotifyFetch(`${API_BASE}/artists/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res?.ok) return null;

  const artist = (await res.json()) as SpotifyArtistApi;
  if (!artist?.id) return null;
  return mapArtistApiToProfile(artist);
}

type SpotifyArtistSearchJson = {
  artists?: { items: SpotifyArtistApi[] };
};

export async function searchSpotifyArtist(
  name: string,
  market: string = "BR",
): Promise<SpotifyArtistProfile | null> {
  const many = await searchSpotifyArtists(name, 1, market);
  return many[0] ?? null;
}

/** Vários artistas (para backfill / desambiguação). */
export async function searchSpotifyArtists(
  name: string,
  limit = 5,
  market: string = "US",
): Promise<SpotifyArtistProfile[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const lim = Math.min(10, Math.max(1, limit));
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", name.trim());
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", String(lim));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifyArtistSearchJson;
  const items = json.artists?.items ?? [];
  return items.map(mapArtistApiToProfile);
}

type SpotifyTopTracksJson = { tracks: SpotifyTrackApi[] };

/** Top tracks do artista (útil quando a pesquisa global de faixa não encontra). */
export async function getSpotifyArtistTopTracks(
  artistSpotifyId: string,
  market: string = "US",
): Promise<SpotifyTrackApi[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const id = artistSpotifyId.trim();
  if (!id) return [];

  const res = await spotifyFetch(
    `${API_BASE}/artists/${encodeURIComponent(id)}/top-tracks?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
  );
  if (!res?.ok) return [];
  const json = (await res.json()) as SpotifyTopTracksJson;
  return json.tracks ?? [];
}

type SpotifyAlbumSearchItem = {
  id: string;
  name: string;
  album_type?: string;
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  external_urls?: { spotify?: string };
  artists: { id: string; name: string }[];
};

type SpotifyAlbumSearchJson = {
  albums?: { items: SpotifyAlbumSearchItem[] };
};

export type SpotifyAlbumSearchResult = {
  spotifyId: string;
  title: string;
  artist: string;
  artistSpotifyId: string | null;
  coverUrl: string | null;
  albumType: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  spotifyUrl: string | null;
};

const ALBUM_EDITION_PAREN_PATTERN =
  /\s*\((?:deluxe|super\s+deluxe|special|bonus(?:\s+track[s]?)?|expanded|anniversary|remaster(?:ed)?|reissue|re-?release|edition|version|explicit)[^)]*\)/gi;

const ALBUM_EDITION_SUFFIX_PATTERN =
  /\s*[\-–—]\s*(?:deluxe|super\s+deluxe|special\s+edition|bonus(?:\s+track[s]?)?|expanded|anniversary|remaster(?:ed)?|reissue|re-?release)[^\-–—]*$/i;

function canonicalAlbumKey(album: SpotifyAlbumSearchItem): string {
  const title = album.name
    .replace(ALBUM_EDITION_PAREN_PATTERN, "")
    .replace(ALBUM_EDITION_SUFFIX_PATTERN, "")
    .toLowerCase()
    .trim();
  const artist = (album.artists[0]?.name ?? "").toLowerCase().trim();
  return `${artist}|${title}`;
}

function pickBestAlbum(albums: SpotifyAlbumSearchItem[]): SpotifyAlbumSearchItem {
  return [...albums].sort((a, b) => {
    const aEdition = EDITION_PATTERN.test(a.name) ? 1 : 0;
    const bEdition = EDITION_PATTERN.test(b.name) ? 1 : 0;
    if (aEdition !== bEdition) return aEdition - bEdition;
    return sortReleaseMs(a.release_date) - sortReleaseMs(b.release_date);
  })[0];
}

export async function searchSpotifyAlbums(
  query: string,
  limit = 8,
  market: string = "BR",
): Promise<SpotifyAlbumSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const token = await getAccessToken();
  if (!token) return [];

  const lim = Math.min(20, Math.max(1, limit));
  const fetchLimit = Math.min(50, lim * 4);
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "album");
  url.searchParams.set("limit", String(fetchLimit));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifyAlbumSearchJson;
  const items = json.albums?.items ?? [];

  try {
    const groups = new Map<string, SpotifyAlbumSearchItem[]>();
    for (const item of items) {
      const key = canonicalAlbumKey(item);
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }

    return [...groups.values()]
      .map(pickBestAlbum)
      .slice(0, lim)
      .map((a) => {
        const rd = parseSpotifyReleaseDate(a.release_date);
        return {
          spotifyId: a.id,
          title: a.name,
          artist: a.artists.map((ar) => ar.name).join(", "),
          artistSpotifyId: a.artists[0]?.id ?? null,
          coverUrl: pickAlbumImageUrl(a.images),
          albumType: mapAlbumType(a.album_type),
          releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
          totalTracks: a.total_tracks ?? null,
          spotifyUrl: a.external_urls?.spotify ?? null,
        };
      });
  } catch (err) {
    console.error("[searchSpotifyAlbums] dedup error, falling back to raw results:", err);
    return items.slice(0, lim).map((a) => {
      const rd = parseSpotifyReleaseDate(a.release_date);
      return {
        spotifyId: a.id,
        title: a.name,
        artist: a.artists.map((ar) => ar.name).join(", "),
        artistSpotifyId: a.artists[0]?.id ?? null,
        coverUrl: pickAlbumImageUrl(a.images),
        albumType: mapAlbumType(a.album_type),
        releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
        totalTracks: a.total_tracks ?? null,
        spotifyUrl: a.external_urls?.spotify ?? null,
      };
    });
  }
}

export async function resolveCoverImageUrl(artist: string, title: string): Promise<string | null> {
  const key = trimKey(artist, title);
  if (coverCache.has(key)) return coverCache.get(key)!;

  const token = await getAccessToken();
  if (!token) {
    cacheSet(key, null);
    return null;
  }

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", `${title} ${artist}`);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "1");
  url.searchParams.set("market", "BR");

  const res = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res?.ok) {
    cacheSet(key, null);
    return null;
  }

  const json = (await res.json()) as SpotifySearchJson;
  const track = json.tracks?.items?.[0];
  const img = track ? pickAlbumImageUrl(track.album.images) : null;
  cacheSet(key, img);
  return img;
}

const trackCoverCache = new Map<string, string | null>();
const TRACK_COVER_CACHE_MAX = 300;

function trackCoverCacheSet(id: string, url: string | null) {
  if (trackCoverCache.size >= TRACK_COVER_CACHE_MAX) {
    const first = trackCoverCache.keys().next().value;
    if (first !== undefined) trackCoverCache.delete(first);
  }
  trackCoverCache.set(id, url);
}

/** Busca capas de álbum para uma lista de track IDs do Spotify (lotes de 50). */
export async function fetchSpotifyTrackCovers(trackIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (trackIds.length === 0) return result;

  const missing: string[] = [];
  for (const id of trackIds) {
    if (trackCoverCache.has(id)) {
      result.set(id, trackCoverCache.get(id)!);
    } else {
      missing.push(id);
    }
  }
  if (missing.length === 0) return result;

  const token = await getAccessToken();
  if (!token) return result;

  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const res = await spotifyFetch(
      `${API_BASE}/tracks?ids=${batch.join(",")}&market=BR`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
    );
    if (!res?.ok) continue;
    const json = (await res.json()) as { tracks?: SpotifyTrackApi[] };
    for (const track of json.tracks ?? []) {
      if (!track?.id) continue;
      const url = pickAlbumImageUrl(track.album?.images);
      trackCoverCacheSet(track.id, url);
      result.set(track.id, url);
    }
  }

  return result;
}
