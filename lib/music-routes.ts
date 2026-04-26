function slugify(s: string): string {
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

export function buildSongPath(song: {
  title: string;
  artist: string;
  spotifyId?: string | null;
}): string {
  const slug = `${slugify(song.title)}_${slugify(song.artist)}`;
  if (song.spotifyId) return `/song/${song.spotifyId}_${slug}`;
  return `/song/${slug}`;
}

export function buildArtistPath(name: string, spotifyId?: string | null): string {
  if (spotifyId) return `/artist/${spotifyId}_${slugify(name)}`;
  return `/artist/${encodeURIComponent(name)}`;
}

export type ParsedSongSlug =
  | { type: "spotify"; spotifyId: string }
  | { type: "slug"; title: string; artist: string };

export function parseSongSlug(slug: string): ParsedSongSlug | null {
  const sep = slug.indexOf("_");
  if (sep === -1) return null;
  const prefix = slug.slice(0, sep);
  const rest = slug.slice(sep + 1);
  if (isSpotifyId(prefix)) return { type: "spotify", spotifyId: prefix };
  // Fallback: prefix = title slug, rest = artist slug
  const title = prefix.replace(/-/g, " ").trim();
  const artist = rest.replace(/-/g, " ").trim();
  if (!title || !artist) return null;
  return { type: "slug", title, artist };
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
