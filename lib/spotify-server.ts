/**
 * Integração com a Web API do Spotify (client credentials).
 * Usar apenas em Route Handlers / Server Components — nunca no bundle do cliente.
 */

const AUTH_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

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

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;

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

export async function searchSpotifyTracks(query: string, limit = 10) {
  const token = await getAccessToken();
  if (!token) return [];

  const q = query.trim();
  const lim = Math.min(50, Math.max(1, limit));
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(lim));
  url.searchParams.set("market", "BR");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];

  const json = (await res.json()) as SpotifySearchJson;
  const items = json.tracks?.items ?? [];
  return items.map(mapTrackToResult);
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

export async function getSpotifyTrackMetadataById(trackId: string): Promise<SpotifyTrackMetadata | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = trackId.trim();
  if (!id) return null;

  const res = await fetch(`${API_BASE}/tracks/${encodeURIComponent(id)}?market=BR`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
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

  const res = await fetch(`${API_BASE}/artists/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const artist = (await res.json()) as SpotifyArtistApi;
  if (!artist?.id) return null;
  return mapArtistApiToProfile(artist);
}

type SpotifyArtistSearchJson = {
  artists?: { items: SpotifyArtistApi[] };
};

export async function searchSpotifyArtist(
  name: string
): Promise<SpotifyArtistProfile | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", name.trim());
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", "1");
  url.searchParams.set("market", "BR");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as SpotifyArtistSearchJson;
  const artist = json.artists?.items?.[0];
  if (!artist) return null;

  return mapArtistApiToProfile(artist);
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

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    cacheSet(key, null);
    return null;
  }

  const json = (await res.json()) as SpotifySearchJson;
  const track = json.tracks?.items?.[0];
  const img = track ? pickAlbumImageUrl(track.album.images) : null;
  cacheSet(key, img);
  return img;
}
