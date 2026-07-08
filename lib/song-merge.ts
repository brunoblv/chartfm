import { prisma } from "@/lib/prisma";

/**
 * Move referências de chart (e feats) da música `dropId` para `keepId` e apaga `dropId`.
 * Usado tanto pela deduplicação manual quanto pela resolução de flags de usuário.
 */
export async function mergeSongs(keepId: string, dropId: string): Promise<void> {
  if (!keepId || !dropId || keepId === dropId) return;

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.song.findUnique({
        where: { id: keepId },
        select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true, artistSpotifyId: true },
      }),
      tx.song.findUnique({
        where: { id: dropId },
        select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true, artistSpotifyId: true },
      }),
    ]);
    if (!keep || !drop) return;

    let targetSpotifyId = keep.spotifyId;
    if (!targetSpotifyId && drop.spotifyId) {
      targetSpotifyId = drop.spotifyId;
      await tx.song.update({
        where: { id: keep.id },
        data: {
          spotifyId: drop.spotifyId,
          album: keep.album ?? drop.album,
          albumSpotifyId: keep.albumSpotifyId ?? drop.albumSpotifyId,
          artistSpotifyId: keep.artistSpotifyId ?? drop.artistSpotifyId,
        },
      });
    }

    await tx.chartEntry.updateMany({
      where: { songId: drop.id },
      data: {
        songId: keep.id,
        ...(targetSpotifyId ? { songSpotifyId: targetSpotifyId } : {}),
      },
    });

    if (drop.spotifyId) {
      await tx.chartEntry.updateMany({
        where: { songSpotifyId: drop.spotifyId },
        data: { songSpotifyId: targetSpotifyId ?? null },
      });

      if (targetSpotifyId && targetSpotifyId !== drop.spotifyId) {
        const oldFeats = await tx.songFeat.findMany({
          where: { songSpotifyId: drop.spotifyId },
          select: { artistSpotifyId: true },
        });
        for (const feat of oldFeats) {
          await tx.songFeat.upsert({
            where: {
              songSpotifyId_artistSpotifyId: {
                songSpotifyId: targetSpotifyId,
                artistSpotifyId: feat.artistSpotifyId,
              },
            },
            update: {},
            create: { songSpotifyId: targetSpotifyId, artistSpotifyId: feat.artistSpotifyId },
          });
        }
        await tx.songFeat.deleteMany({ where: { songSpotifyId: drop.spotifyId } });
      }
    }

    await tx.song.delete({ where: { id: drop.id } });
  });
}
