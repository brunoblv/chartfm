import { prisma } from "@/lib/prisma";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";

/** Resolve URLs de vídeo clipe por spotifyId (escolha do dono → mais votado). */
export async function resolveMyTrlVideoClips(
  ownerUserId: string,
  spotifyIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(spotifyIds.filter(Boolean))] as string[];
  if (ids.length === 0) return {};

  const songs = await prisma.song.findMany({
    where: { spotifyId: { in: ids } },
    select: { id: true, spotifyId: true },
  });

  const songIdBySpotify = new Map(songs.map((s) => [s.spotifyId!, s.id]));
  const songIds = songs.map((s) => s.id);
  if (songIds.length === 0) return {};

  const choices = await prisma.userSongVideoClipChoice.findMany({
    where: { userId: ownerUserId, songId: { in: songIds } },
    select: { songId: true, clip: { select: { imageUrl: true } } },
  });

  const clipBySongId: Record<string, string> = {};
  const chosen = new Set<string>();

  for (const choice of choices) {
    clipBySongId[choice.songId] = choice.clip.imageUrl;
    chosen.add(choice.songId);
  }

  const unchosen = songIds.filter((id) => !chosen.has(id));
  if (unchosen.length > 0) {
    const topClips = await prisma.songVideoClip.findMany({
      where: { songId: { in: unchosen } },
      orderBy: { votes: "desc" },
      select: { songId: true, imageUrl: true },
    });

    for (const clip of topClips) {
      if (!clipBySongId[clip.songId]) clipBySongId[clip.songId] = clip.imageUrl;
    }
  }

  const result: Record<string, string> = {};
  for (const [spotifyId, songId] of songIdBySpotify) {
    const url = clipBySongId[songId];
    if (url) result[spotifyId] = url;
  }
  return result;
}

export function collectSpotifyIds(entries: MyTrlChartEntry[]): string[] {
  return entries.map((e) => e.spotifyId).filter(Boolean) as string[];
}
