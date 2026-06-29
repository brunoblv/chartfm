import type { Prisma, PrismaClient } from "@prisma/client";
import { fetchLastfmTrackTags } from "@/lib/lastfm-track-tags";
import { resolveMusicBrainzSongGenres } from "@/lib/musicbrainz";

export type SongGenreSource = "musicbrainz" | "lastfm" | "artist";

export type ResolvedSongGenres = {
  genres: string[];
  source: SongGenreSource;
  recordingMbid: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

export type SongGenreInput = {
  id?: string;
  title: string;
  artist: string;
  spotifyId?: string | null;
  isrc?: string | null;
  recordingMbid?: string | null;
  artistGenres?: string[];
};

/** MusicBrainz → Last.fm → gêneros do artista. */
export async function resolveSongGenres(input: SongGenreInput): Promise<ResolvedSongGenres> {
  const artistFallback = (input.artistGenres ?? []).map((g) => g.trim().toLowerCase()).filter(Boolean);

  try {
    const mb = await resolveMusicBrainzSongGenres({
      title: input.title,
      artist: input.artist,
      spotifyId: input.spotifyId,
      isrc: input.isrc,
      recordingMbid: input.recordingMbid,
    });
    if (mb?.tags.length) {
      return {
        genres: mb.tags,
        source: "musicbrainz",
        recordingMbid: mb.mbid,
      };
    }
  } catch {
    // segue para Last.fm
  }

  try {
    const lf = await fetchLastfmTrackTags(input.title, input.artist, input.recordingMbid);
    if (lf?.tags.length) {
      return {
        genres: lf.tags,
        source: "lastfm",
        recordingMbid: lf.mbid ?? input.recordingMbid?.trim() ?? null,
      };
    }
  } catch {
    // segue para artista
  }

  return {
    genres: artistFallback,
    source: "artist",
    recordingMbid: input.recordingMbid?.trim() ?? null,
  };
}

export async function fetchAndSaveSongGenres(
  db: Db,
  songId: string,
): Promise<ResolvedSongGenres | null> {
  const song = await db.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      isrc: true,
      recordingMbid: true,
      artistRef: { select: { genres: true } },
    },
  });
  if (!song) return null;

  const resolved = await resolveSongGenres({
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: song.spotifyId,
    isrc: song.isrc,
    recordingMbid: song.recordingMbid,
    artistGenres: song.artistRef?.genres,
  });

  await db.song.update({
    where: { id: songId },
    data: {
      genres: resolved.genres,
      genreSource: resolved.source,
      recordingMbid: resolved.recordingMbid,
      genresFetchedAt: new Date(),
    },
  });

  return resolved;
}

/** Ainda não passou pelo resolver MusicBrainz → Last.fm → artista. */
export const songMissingGenresWhere: Prisma.SongWhereInput = {
  genresFetchedAt: null,
};

/** Backfill: músicas cadastradas mais recentemente primeiro. */
export const songGenresBackfillOrderBy: Prisma.SongOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];
