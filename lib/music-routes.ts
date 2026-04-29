export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isPositiveIntId(s: string): boolean {
  return /^\d+$/.test(s.trim()) && Number(s) > 0;
}

// Spotify IDs: exactly 22 base62 chars, always mixed case
function isSpotifyId(s: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(s) && /[A-Z]/.test(s);
}

/**
 * ID de `Song` no banco quando não há Spotify no slug.
 * Aceita:
 * - Prisma `cuid()` (ex.: começa com `c`, ~25 chars)
 * - UUID com hífens
 * - UUID “compacto” (32 hex, sem hífens) — ex.: `ef1c462c6c144bfa8d00061bbf9a8ef5`
 */
function isInternalSongId(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return true;
  if (/^[0-9a-f]{32}$/i.test(t)) return true;
  return /^c[a-z0-9]{8,32}$/i.test(t) && t.length >= 20 && t.length <= 36;
}

export function buildSongPath(song: {
  title: string;
  artist: string;
  id?: string | null;
  artistId?: number | string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
}): string {
  const artistDbId = song.artistId != null ? String(song.artistId).trim() : "";
  const songDbId = song.id?.trim() ?? "";
  if (isPositiveIntId(artistDbId) && songDbId) {
    return `/song/${artistDbId}_${songDbId}`;
  }
  const sid = song.spotifyId?.trim();
  if (sid) {
    const artistForSlug = (song.slugArtist ?? song.artist).trim();
    const slug = `${slugify(song.title)}_${slugify(artistForSlug)}`;
    return `/song/${sid}_${slug}`;
  }
  const internalId = song.id?.trim();
  if (internalId) return `/song/${internalId}`;
  const artistForSlug = (song.slugArtist ?? song.artist).trim();
  const slug = `${slugify(song.title)}_${slugify(artistForSlug)}`;
  return `/song/${slug}`;
}

export function buildArtistPath(name: string, spotifyId?: string | null, artistId?: number | string | null): string {
  const aid = artistId != null ? String(artistId).trim() : "";
  if (isPositiveIntId(aid)) return `/artist/${aid}`;
  if (spotifyId) return `/artist/${spotifyId}_${slugify(name)}`;
  return `/artist/${encodeURIComponent(name)}`;
}

export type ParsedSongSlug =
  | { type: "artistSongIds"; artistId: number; songId: string }
  | { type: "spotify"; spotifyId: string }
  | { type: "internalId"; songId: string }
  | { type: "slug"; titleSlug: string; artistSlug: string };

export function parseSongSlug(slug: string): ParsedSongSlug | null {
  let raw: string;
  try {
    raw = decodeURIComponent(slug.trim());
  } catch {
    raw = slug.trim();
  }
  if (!raw) return null;

  if (!raw.includes("_")) {
    if (isInternalSongId(raw)) return { type: "internalId", songId: raw };
    return null;
  }

  const sep = raw.indexOf("_");
  const prefix = raw.slice(0, sep);
  const rest = raw.slice(sep + 1);
  if (isPositiveIntId(prefix) && rest) return { type: "artistSongIds", artistId: Number(prefix), songId: rest };
  if (isSpotifyId(prefix)) return { type: "spotify", spotifyId: prefix };
  if (!prefix || !rest) return null;
  return { type: "slug", titleSlug: prefix, artistSlug: rest };
}

export function buildAlbumPath(
  album: string,
  artist: string,
  ids?: { artistId?: number | string | null; albumId?: number | string | null },
): string {
  const aid = ids?.artistId != null ? String(ids.artistId).trim() : "";
  const alid = ids?.albumId != null ? String(ids.albumId).trim() : "";
  if (isPositiveIntId(aid) && isPositiveIntId(alid)) return `/album/${aid}_${alid}`;
  return `/album/${slugify(artist)}_${slugify(album)}`;
}

export type ParsedAlbumSlug =
  | { type: "artistAlbumIds"; artistId: number; albumId: number }
  | { type: "slug"; artistSlug: string; albumSlug: string };

export function parseAlbumSlug(slug: string): ParsedAlbumSlug | null {
  let raw: string;
  try {
    raw = decodeURIComponent(slug.trim());
  } catch {
    raw = slug.trim();
  }
  const sep = raw.indexOf("_");
  if (sep === -1) return null;
  const a = raw.slice(0, sep);
  const b = raw.slice(sep + 1);
  if (isPositiveIntId(a) && isPositiveIntId(b)) {
    return { type: "artistAlbumIds", artistId: Number(a), albumId: Number(b) };
  }
  return { type: "slug", artistSlug: a, albumSlug: b };
}

export type ParsedArtistSlug =
  | { type: "dbId"; artistId: number }
  | { type: "spotify"; spotifyId: string }
  | { type: "slug"; name: string };

export function parseArtistSlug(slug: string): ParsedArtistSlug {
  const trimmed = slug.trim();
  if (isPositiveIntId(trimmed)) return { type: "dbId", artistId: Number(trimmed) };
  const sep = slug.indexOf("_");
  if (sep !== -1) {
    const prefix = slug.slice(0, sep);
    if (isSpotifyId(prefix)) return { type: "spotify", spotifyId: prefix };
  }
  // Fallback: encoded name (decodeURIComponent preserves original name exactly)
  try {
    const name = decodeURIComponent(slug);
    return { type: "slug", name };
  } catch {
    return { type: "slug", name: slug };
  }
}
