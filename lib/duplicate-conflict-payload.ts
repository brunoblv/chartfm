import { buildAlbumPath, buildSongPath } from "@/lib/music-routes";

export type DuplicateSongConflict = {
  kind: "song";
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  artistId: number | null;
  href: string;
  editHref: string;
};

export type DuplicateAlbumConflict = {
  kind: "album";
  id: number;
  title: string;
  artist: string;
  artistId: number;
  href: string;
  editHref: string;
};

export type DuplicateConflict = DuplicateSongConflict | DuplicateAlbumConflict;

export function buildSongConflictPayload(song: {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  artistId?: number | null;
}): DuplicateSongConflict {
  const artistId = song.artistId ?? null;
  const href = buildSongPath({
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: song.spotifyId,
    artistId,
  });
  return {
    kind: "song",
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: song.spotifyId,
    artistId,
    href,
    editHref: `${href}/edit`,
  };
}

export function buildAlbumConflictPayload(album: {
  id: number;
  title: string;
  artist: { id: number; name: string };
}): DuplicateAlbumConflict {
  const href = buildAlbumPath(album.title, album.artist.name, {
    artistId: album.artist.id,
    albumId: album.id,
  });
  return {
    kind: "album",
    id: album.id,
    title: album.title,
    artist: album.artist.name,
    artistId: album.artist.id,
    href,
    editHref: `${href}/edit`,
  };
}

export function songConflictBody(conflict: DuplicateSongConflict) {
  return {
    error: "song_already_exists_same_title_artist" as const,
    message: `Já existe uma música com este nome para ${conflict.artist}.`,
    conflict,
  };
}

export function albumConflictBody(conflict: DuplicateAlbumConflict) {
  return {
    error: "album_already_exists" as const,
    message: `Já existe um álbum com este nome para ${conflict.artist}.`,
    conflict,
  };
}
