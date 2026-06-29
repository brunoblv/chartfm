import type { Prisma, PrismaClient } from "@prisma/client";
import { fetchLastfmTrackTags } from "@/lib/lastfm-track-tags";
import { getMusicBrainzReleaseDate, resolveMusicBrainzSongGenres } from "@/lib/musicbrainz";
import { prisma } from "@/lib/prisma";

export type SongGenreSource = "musicbrainz" | "lastfm" | "artist";
export type SongReleaseDateSource = "music-video" | "single" | null;

export type ResolvedSongGenres = {
  genres: string[];
  source: SongGenreSource;
  recordingMbid: string | null;
  singleReleaseDate: Date | null;
  releaseDateSource: SongReleaseDateSource;
};

const RELEASE_DATES_VERSION = 2;

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

async function fetchReleaseDate(mbid: string): Promise<{
  date: Date | null;
  source: SongReleaseDateSource;
}> {
  try {
    return await getMusicBrainzReleaseDate(mbid);
  } catch {
    return { date: null, source: null };
  }
}

/** MusicBrainz → Last.fm → gêneros do artista. Data: videoclipe, senão single. */
export async function resolveSongGenres(input: SongGenreInput): Promise<ResolvedSongGenres> {
  const artistFallback = (input.artistGenres ?? []).map((g) => g.trim().toLowerCase()).filter(Boolean);
  let recordingMbid = input.recordingMbid?.trim() || null;
  let singleReleaseDate: Date | null = null;
  let releaseDateSource: SongReleaseDateSource = null;

  try {
    const mb = await resolveMusicBrainzSongGenres({
      title: input.title,
      artist: input.artist,
      spotifyId: input.spotifyId,
      isrc: input.isrc,
      recordingMbid: input.recordingMbid,
    });
    if (mb) {
      recordingMbid = mb.mbid;
      const release = await fetchReleaseDate(mb.mbid);
      singleReleaseDate = release.date;
      releaseDateSource = release.source;
      if (mb.tags.length) {
        return {
          genres: mb.tags,
          source: "musicbrainz",
          recordingMbid: mb.mbid,
          singleReleaseDate,
          releaseDateSource,
        };
      }
    }
  } catch {
    // segue para Last.fm
  }

  if (recordingMbid && !singleReleaseDate) {
    const release = await fetchReleaseDate(recordingMbid);
    singleReleaseDate = release.date;
    releaseDateSource = release.source;
  }

  try {
    const lf = await fetchLastfmTrackTags(input.title, input.artist, recordingMbid);
    if (lf?.tags.length) {
      return {
        genres: lf.tags,
        source: "lastfm",
        recordingMbid: lf.mbid ?? recordingMbid,
        singleReleaseDate,
        releaseDateSource,
      };
    }
  } catch {
    // segue para artista
  }

  return {
    genres: artistFallback,
    source: "artist",
    recordingMbid,
    singleReleaseDate,
    releaseDateSource,
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
      ...(resolved.singleReleaseDate != null ? { singleReleaseDate: resolved.singleReleaseDate } : {}),
      singleReleaseDateFetchedAt: new Date(),
      releaseDatesVersion: RELEASE_DATES_VERSION,
    },
  });

  return resolved;
}

/** Enriquecimento pendente: tags ou datas (v2) ainda não buscadas. */
export const songEnrichmentPendingWhere: Prisma.SongWhereInput = {
  OR: [{ genresFetchedAt: null }, { releaseDatesVersion: { lt: RELEASE_DATES_VERSION } }],
};

/** @deprecated use songEnrichmentPendingWhere */
export const songMissingGenresWhere: Prisma.SongWhereInput = songEnrichmentPendingWhere;

/** Backfill: músicas cadastradas mais recentemente primeiro. */
export const songGenresBackfillOrderBy: Prisma.SongOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/** Busca tags + data de lançamento em background após cadastro/atualização. */
export function enrichSongMetadataAfterSave(songId: string): void {
  void fetchAndSaveSongGenres(prisma, songId).catch(() => {
    // falha silenciosa — admin pode rodar backfill depois
  });
}
