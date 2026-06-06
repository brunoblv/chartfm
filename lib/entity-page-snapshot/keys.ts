import { slugify, type ParsedAlbumSlug, type ParsedArtistSlug } from "@/lib/music-routes";

export function artistEntityKey(
  parsed: ParsedArtistSlug,
  artistRef?: { id: number; spotifyId: string } | null,
): string {
  if (artistRef?.id) return `db:${artistRef.id}`;
  if (parsed.type === "dbId") return `db:${parsed.artistId}`;
  if (parsed.type === "spotify") return `spotify:${parsed.spotifyId}`;
  return `name:${slugify(parsed.name)}`;
}

export function albumEntityKey(parsed: ParsedAlbumSlug): string {
  if (parsed.type === "artistAlbumIds") return `db:${parsed.artistId}:${parsed.albumId}`;
  return `slug:${parsed.artistSlug}_${parsed.albumSlug}`;
}

export function songEntityKey(songId: string): string {
  return `id:${songId}`;
}
