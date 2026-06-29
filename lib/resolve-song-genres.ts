import type { Prisma, PrismaClient } from "@prisma/client";
import { fetchLastfmTrackTags } from "@/lib/lastfm-track-tags";
import { getMusicBrainzReleaseDates, resolveMusicBrainzSongGenres } from "@/lib/musicbrainz";
import { prisma } from "@/lib/prisma";
import { getYouTubeMusicVideoReleaseDate } from "@/lib/youtube-music-video-date";

export type SongGenreSource = "musicbrainz" | "lastfm" | "artist";

export type ResolvedSongGenres = {
  genres: string[];
  source: SongGenreSource;
  recordingMbid: string | null;
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
  youtubeReleaseDate: Date | null;
};

const RELEASE_DATES_VERSION = 4;

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

async function fetchAllReleaseDates(
  mbid: string | null,
  title: string,
  artist: string,
): Promise<Pick<ResolvedSongGenres, "singleReleaseDate" | "musicVideoReleaseDate" | "youtubeReleaseDate">> {
  const empty = {
    singleReleaseDate: null,
    musicVideoReleaseDate: null,
    youtubeReleaseDate: null,
  };

  const [mbDates, yt] = await Promise.all([
    mbid
      ? getMusicBrainzReleaseDates(mbid, { title, artist }).catch(() => empty)
      : Promise.resolve(empty),
    getYouTubeMusicVideoReleaseDate(title, artist).catch(() => ({
      date: null,
      videoId: null,
      title: null,
    })),
  ]);

  return {
    singleReleaseDate: mbDates.singleReleaseDate,
    musicVideoReleaseDate: mbDates.musicVideoReleaseDate,
    youtubeReleaseDate: yt.date,
  };
}

/** MusicBrainz → Last.fm → gêneros do artista. Três datas: YouTube, single MB, clipe MB. */
export async function resolveSongGenres(input: SongGenreInput): Promise<ResolvedSongGenres> {
  const artistFallback = (input.artistGenres ?? []).map((g) => g.trim().toLowerCase()).filter(Boolean);
  let recordingMbid = input.recordingMbid?.trim() || null;
  let releaseDates = await fetchAllReleaseDates(recordingMbid, input.title, input.artist);

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
      releaseDates = await fetchAllReleaseDates(mb.mbid, input.title, input.artist);
      if (mb.tags.length) {
        return {
          genres: mb.tags,
          source: "musicbrainz",
          recordingMbid: mb.mbid,
          ...releaseDates,
        };
      }
    }
  } catch {
    // segue para Last.fm
  }

  if (recordingMbid && !releaseDates.singleReleaseDate && !releaseDates.musicVideoReleaseDate) {
    const mbOnly = await getMusicBrainzReleaseDates(recordingMbid, {
      title: input.title,
      artist: input.artist,
    }).catch(() => ({
      singleReleaseDate: null,
      musicVideoReleaseDate: null,
    }));
    releaseDates = { ...releaseDates, ...mbOnly };
  }

  if (!releaseDates.youtubeReleaseDate) {
    const yt = await getYouTubeMusicVideoReleaseDate(input.title, input.artist).catch(() => ({
      date: null,
      videoId: null,
      title: null,
    }));
    if (yt.date) releaseDates = { ...releaseDates, youtubeReleaseDate: yt.date };
  }

  try {
    const lf = await fetchLastfmTrackTags(input.title, input.artist, recordingMbid);
    if (lf?.tags.length) {
      return {
        genres: lf.tags,
        source: "lastfm",
        recordingMbid: lf.mbid ?? recordingMbid,
        ...releaseDates,
      };
    }
  } catch {
    // segue para artista
  }

  return {
    genres: artistFallback,
    source: "artist",
    recordingMbid,
    ...releaseDates,
  };
}

function releaseDatesUpdateData(resolved: ResolvedSongGenres): Prisma.SongUpdateInput {
  return {
    ...(resolved.singleReleaseDate != null ? { singleReleaseDate: resolved.singleReleaseDate } : {}),
    ...(resolved.musicVideoReleaseDate != null
      ? { musicVideoReleaseDate: resolved.musicVideoReleaseDate }
      : {}),
    ...(resolved.youtubeReleaseDate != null ? { youtubeReleaseDate: resolved.youtubeReleaseDate } : {}),
    singleReleaseDateFetchedAt: new Date(),
    releaseDatesVersion: RELEASE_DATES_VERSION,
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
      ...releaseDatesUpdateData(resolved),
    },
  });

  return resolved;
}

/** Enriquecimento pendente: tags ou datas (v4) ainda não buscadas. */
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

/** Busca tags + datas em background após cadastro/atualização. */
export function enrichSongMetadataAfterSave(songId: string): void {
  void fetchAndSaveSongGenres(prisma, songId).catch(() => {
    // falha silenciosa — admin pode rodar backfill depois
  });
}
