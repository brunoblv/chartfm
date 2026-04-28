export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Spotify IDs: exactly 22 base62 chars, always mixed case
function isSpotifyId(s: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(s) && /[A-Z]/.test(s);
}

/** Prisma `cuid()` (~25 chars, começa por `c`) — segmento único em `/song/<id>` sem Spotify. */
function isInternalSongId(s: string): boolean {
  const t = s.trim();
  return /^c[a-z0-9]{8,32}$/i.test(t) && t.length >= 20 && t.length <= 36;
}

export function buildSongPath(song: {
  title: string;
  artist: string;
  id?: string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
}): string {
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

export function buildArtistPath(name: string, spotifyId?: string | null): string {
  if (spotifyId) return `/artist/${spotifyId}_${slugify(name)}`;
  return `/artist/${encodeURIComponent(name)}`;
}

export type ParsedSongSlug =
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
  if (isSpotifyId(prefix)) return { type: "spotify", spotifyId: prefix };
  if (!prefix || !rest) return null;
  return { type: "slug", titleSlug: prefix, artistSlug: rest };
}

export type ParsedArtistSlug =
  | { type: "spotify"; spotifyId: string }
  | { type: "slug"; name: string };

export function parseArtistSlug(slug: string): ParsedArtistSlug {
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
