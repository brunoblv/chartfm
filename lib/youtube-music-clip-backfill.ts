/**
 * Busca video clipes de música no YouTube e armazena na DB.
 * Filtra excluindo lyrics videos, visualizers e áudio-only.
 * Retorna null se não encontrar um clipe válido (marcado para revisão manual).
 */

import { prisma } from "@/lib/prisma";
import {
  getYouTubeMusicVideoReleaseDate,
  getYouTubeVideoPublishedAt,
} from "@/lib/youtube-music-video-date";

/** Marcação em Song.sourcesNotFound: YouTube já consultado sem clipe válido — o backfill pula até correção manual. */
export const YOUTUBE_CLIP_SOURCE = "youtube_clip";

export type YouTubeClipSearchResult = {
  found: boolean;
  videoId: string | null;
  title: string | null;
  publishedAt: Date | null;
  needsManualReview: boolean;
  error?: string;
};

async function createOrUpdateClip(
  songId: string,
  videoId: string,
  title: string,
  publishedAt: Date | null,
  adminUserId: string,
): Promise<{ created: boolean; clipId: string }> {
  const existingClip = await prisma.songVideoClip.findFirst({
    where: { songId, youtubeId: videoId },
    select: { id: true, publishedAt: true },
  });

  if (existingClip) {
    // Preenche publishedAt do clipe se ainda estiver vazio.
    if (!existingClip.publishedAt && publishedAt) {
      await prisma.songVideoClip.update({
        where: { id: existingClip.id },
        data: { publishedAt },
      });
    }
    return { created: false, clipId: existingClip.id };
  }

  const clip = await prisma.songVideoClip.create({
    data: {
      songId,
      youtubeId: videoId,
      imageUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      publishedAt: publishedAt ?? undefined,
      clipType: "OFFICIAL",
      uploadedBy: adminUserId,
    },
    select: { id: true },
  });

  return { created: true, clipId: clip.id };
}

async function applyClipDatesToSong(songId: string, publishedAt: Date | null): Promise<void> {
  if (!publishedAt) return;
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { musicVideoReleaseDate: true, youtubeReleaseDate: true },
  });
  if (!song || (song.musicVideoReleaseDate && song.youtubeReleaseDate)) return;

  await prisma.song.update({
    where: { id: songId },
    data: {
      ...(song.musicVideoReleaseDate ? {} : { musicVideoReleaseDate: publishedAt }),
      ...(song.youtubeReleaseDate ? {} : { youtubeReleaseDate: publishedAt }),
    },
  });
}

/**
 * Se a música já tem clipe com youtubeId mas falta data de postagem no Song/clip,
 * consulta videos.list e preenche (nunca cria clipe novo).
 */
export async function fillYouTubeClipPublishedAt(
  songId: string,
  youtubeId: string,
): Promise<YouTubeClipSearchResult> {
  try {
    const meta = await getYouTubeVideoPublishedAt(youtubeId);
    if (!meta.date) {
      return {
        found: true,
        videoId: youtubeId,
        title: meta.title,
        publishedAt: null,
        needsManualReview: false,
        error: "Não foi possível obter a data de postagem do YouTube",
      };
    }

    const clip = await prisma.songVideoClip.findFirst({
      where: { songId, youtubeId },
      select: { id: true, publishedAt: true },
    });
    if (clip && !clip.publishedAt) {
      await prisma.songVideoClip.update({
        where: { id: clip.id },
        data: { publishedAt: meta.date },
      });
    }

    await applyClipDatesToSong(songId, meta.date);

    return {
      found: true,
      videoId: youtubeId,
      title: meta.title,
      publishedAt: meta.date,
      needsManualReview: false,
    };
  } catch (error) {
    return {
      found: true,
      videoId: youtubeId,
      title: null,
      publishedAt: null,
      needsManualReview: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function searchAndCreateYouTubeClip(
  songId: string,
  songTitle: string,
  artistName: string,
  adminUserId: string,
): Promise<YouTubeClipSearchResult> {
  try {
    const result = await getYouTubeMusicVideoReleaseDate(songTitle, artistName);

    if (!result.videoId) {
      return {
        found: false,
        videoId: null,
        title: null,
        publishedAt: null,
        needsManualReview: true,
      };
    }

    await createOrUpdateClip(
      songId,
      result.videoId,
      result.title || "",
      result.date,
      adminUserId,
    );

    await clearManualReviewFlag(songId);
    await applyClipDatesToSong(songId, result.date);

    return {
      found: true,
      videoId: result.videoId,
      title: result.title,
      publishedAt: result.date,
      needsManualReview: false,
    };
  } catch (error) {
    return {
      found: false,
      videoId: null,
      title: null,
      publishedAt: null,
      needsManualReview: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function findSongsWithoutClips(
  limit?: number,
): Promise<
  Array<{
    id: string;
    title: string;
    artist: string;
    spotifyId: string | null;
  }>
> {
  const query = await prisma.song.findMany({
    where: {
      videoClips: { none: {} },
      NOT: { sourcesNotFound: { has: YOUTUBE_CLIP_SOURCE } },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  return query;
}

export async function countSongsWithoutClips(): Promise<number> {
  return prisma.song.count({
    where: {
      videoClips: { none: {} },
      NOT: { sourcesNotFound: { has: YOUTUBE_CLIP_SOURCE } },
    },
  });
}

export async function createManualReviewFlag(songId: string): Promise<void> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { sourcesNotFound: true },
  });
  if (!song || song.sourcesNotFound.includes(YOUTUBE_CLIP_SOURCE)) return;

  await prisma.song.update({
    where: { id: songId },
    data: { sourcesNotFound: [...song.sourcesNotFound, YOUTUBE_CLIP_SOURCE] },
  });
}

export async function clearManualReviewFlag(songId: string): Promise<void> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { sourcesNotFound: true },
  });
  if (!song || !song.sourcesNotFound.includes(YOUTUBE_CLIP_SOURCE)) return;

  await prisma.song.update({
    where: { id: songId },
    data: { sourcesNotFound: song.sourcesNotFound.filter((s) => s !== YOUTUBE_CLIP_SOURCE) },
  });
}

/** Cadastra/atualiza clipe OFFICIAL manualmente (ID ou URL do YouTube). */
export async function assignManualYouTubeClip(
  songId: string,
  youtubeIdOrUrl: string,
  adminUserId: string,
): Promise<YouTubeClipSearchResult> {
  const { extractYoutubeId } = await import("@/lib/videoparada/download-clip");
  const videoId = extractYoutubeId(youtubeIdOrUrl);
  if (!videoId) {
    return {
      found: false,
      videoId: null,
      title: null,
      publishedAt: null,
      needsManualReview: false,
      error: "YouTube ID ou URL inválido",
    };
  }

  const meta = await getYouTubeVideoPublishedAt(videoId);
  await createOrUpdateClip(songId, videoId, meta.title || "", meta.date, adminUserId);
  await clearManualReviewFlag(songId);
  await applyClipDatesToSong(songId, meta.date);

  return {
    found: true,
    videoId,
    title: meta.title,
    publishedAt: meta.date,
    needsManualReview: false,
  };
}
