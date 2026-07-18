/**
 * Busca video clipes de música no YouTube e armazena na DB.
 * Filtra excluindo lyrics videos, visualizers e áudio-only.
 * Retorna null se não encontrar um clipe válido (marcado para revisão manual).
 */

import { prisma } from "@/lib/prisma";
import { getYouTubeMusicVideoReleaseDate } from "@/lib/youtube-music-video-date";

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
  publishedAt: Date,
  adminUserId: string,
): Promise<{ created: boolean; clipId: string }> {
  const existingClip = await prisma.songVideoClip.findFirst({
    where: { songId, youtubeId: videoId },
    select: { id: true },
  });

  if (existingClip) {
    return { created: false, clipId: existingClip.id };
  }

  const clip = await prisma.songVideoClip.create({
    data: {
      songId,
      youtubeId: videoId,
      imageUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      publishedAt,
      clipType: "OFFICIAL",
      uploadedBy: adminUserId,
    },
    select: { id: true },
  });

  return { created: true, clipId: clip.id };
}

export async function searchAndCreateYouTubeClip(
  songId: string,
  songTitle: string,
  artistName: string,
  adminUserId: string,
): Promise<YouTubeClipSearchResult> {
  try {
    // Buscar no YouTube usando a função existente
    const result = await getYouTubeMusicVideoReleaseDate(songTitle, artistName);

    if (!result.videoId) {
      // Nenhum vídeo encontrado
      return {
        found: false,
        videoId: null,
        title: null,
        publishedAt: null,
        needsManualReview: true,
      };
    }

    // Criar ou atualizar o clip no banco
    const clip = await createOrUpdateClip(
      songId,
      result.videoId,
      result.title || "",
      result.date || new Date(),
      adminUserId,
    );

    await clearManualReviewFlag(songId);

    // Preenche as datas de clipe da música se estiverem vazias (nunca sobrescreve).
    if (result.date) {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        select: { musicVideoReleaseDate: true, youtubeReleaseDate: true },
      });
      if (song && (!song.musicVideoReleaseDate || !song.youtubeReleaseDate)) {
        await prisma.song.update({
          where: { id: songId },
          data: {
            ...(song.musicVideoReleaseDate ? {} : { musicVideoReleaseDate: result.date }),
            ...(song.youtubeReleaseDate ? {} : { youtubeReleaseDate: result.date }),
          },
        });
      }
    }

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

async function clearManualReviewFlag(songId: string): Promise<void> {
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
