import type { PrismaClient } from "@prisma/client";
import { canonicalAlbumTitle, canonicalSongTitle } from "@/lib/duplicate-utils";
import {
  buildAlbumConflictPayload,
  buildSongConflictPayload,
  type DuplicateAlbumConflict,
  type DuplicateSongConflict,
} from "@/lib/duplicate-conflict-payload";

type Db = Pick<PrismaClient, "album" | "song" | "artist">;

function titleConflictsWithExisting(
  titles: string[],
  existing: { title: string; exhibitionName: string | null },
  canonicalize: (s: string) => string,
): boolean {
  const incoming = new Set(titles.map(canonicalize));
  const keys = existing.exhibitionName?.trim()
    ? [canonicalize(existing.title), canonicalize(existing.exhibitionName)]
    : [canonicalize(existing.title)];
  return keys.some((k) => incoming.has(k));
}

/** Álbum com o mesmo nome canônico já cadastrado para o artista. */
export async function findConflictingAlbum(
  db: Db,
  params: { artistSpotifyId: string; titles: string[]; excludeAlbumId?: number },
): Promise<DuplicateAlbumConflict | null> {
  const albums = await db.album.findMany({
    where: { artistSpotifyId: params.artistSpotifyId },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      artist: { select: { id: true, name: true } },
    },
  });

  for (const album of albums) {
    if (params.excludeAlbumId != null && album.id === params.excludeAlbumId) continue;
    if (titleConflictsWithExisting(params.titles, album, canonicalAlbumTitle)) {
      return buildAlbumConflictPayload(album);
    }
  }
  return null;
}

/** Música com o mesmo nome canônico já cadastrada para o artista. */
export async function findConflictingSong(
  db: Db,
  params: {
    artistSpotifyId: string;
    titles: string[];
    excludeSongId?: string;
    allowSpotifyId?: string | null;
  },
): Promise<DuplicateSongConflict | null> {
  const artist = await db.artist.findUnique({
    where: { spotifyId: params.artistSpotifyId },
    select: { id: true, name: true },
  });

  const songs = await db.song.findMany({
    where: {
      OR: [
        { artistSpotifyId: params.artistSpotifyId },
        ...(artist ? [{ artist: { equals: artist.name, mode: "insensitive" as const } }] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      spotifyId: true,
      artist: true,
      artistRef: { select: { id: true } },
    },
  });

  const allowId = params.allowSpotifyId?.trim() || null;

  for (const song of songs) {
    if (params.excludeSongId && song.id === params.excludeSongId) continue;
    if (allowId && song.spotifyId?.trim() === allowId) continue;
    if (titleConflictsWithExisting(params.titles, song, canonicalSongTitle)) {
      return buildSongConflictPayload({
        id: song.id,
        title: song.title,
        artist: song.artist,
        spotifyId: song.spotifyId,
        artistId: song.artistRef?.id ?? artist?.id ?? null,
      });
    }
  }
  return null;
}

export async function findAlbumConflictById(
  db: Db,
  albumId: number,
): Promise<DuplicateAlbumConflict | null> {
  const album = await db.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, artist: { select: { id: true, name: true } } },
  });
  return album ? buildAlbumConflictPayload(album) : null;
}

export async function findSongConflictByTitleArtist(
  db: Db,
  title: string,
  artistName: string,
  artistSpotifyId: string,
): Promise<DuplicateSongConflict | null> {
  const song = await db.song.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      artist: { equals: artistName, mode: "insensitive" },
      artistSpotifyId,
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      artistRef: { select: { id: true } },
    },
  });
  if (!song) return null;
  return buildSongConflictPayload({
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: song.spotifyId,
    artistId: song.artistRef?.id ?? null,
  });
}
