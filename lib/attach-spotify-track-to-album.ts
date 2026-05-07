import { prisma } from "@/lib/prisma";
import { getSpotifyTrackMetadataById } from "@/lib/spotify-server";
import { upsertSongFromSpotifyMetadata, type UpsertedSongSummary } from "@/lib/upsert-song-from-spotify-metadata";

export type AttachedAlbumSong = UpsertedSongSummary;

export type AttachSpotifyTrackResult =
  | { ok: true; song: AttachedAlbumSong }
  | { ok: false; error: string; status: number };

/**
 * Liga uma faixa do Spotify ao álbum local, desde que o `album` oficial da faixa
 * coincida com o `spotifyId` do registro `Album` indicado por `albumDbId`.
 */
export async function attachSpotifyTrackToAlbum(albumDbId: number, trackSpotifyId: string): Promise<AttachSpotifyTrackResult> {
  const tid = trackSpotifyId.trim();
  if (!tid) return { ok: false, error: "track_spotify_id_required", status: 400 };

  const album = await prisma.album.findUnique({
    where: { id: albumDbId },
    select: { id: true, spotifyId: true, title: true },
  });
  if (!album) return { ok: false, error: "album_not_found", status: 404 };
  if (!album.spotifyId.trim()) return { ok: false, error: "album_missing_spotify_id", status: 400 };

  const metadata = await getSpotifyTrackMetadataById(tid);
  if (!metadata) return { ok: false, error: "spotify_metadata_failed", status: 502 };

  const metaAlbumId = metadata.album.spotifyId?.trim() ?? "";
  if (!metaAlbumId || metaAlbumId !== album.spotifyId.trim()) {
    return { ok: false, error: "track_not_from_this_album", status: 400 };
  }

  return upsertSongFromSpotifyMetadata(metadata, { albumTitleFallback: album.title });
}
