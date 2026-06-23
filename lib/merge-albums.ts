import type { PrismaClient } from "@prisma/client";

export type MergeAlbumsResult = {
  keepId: number;
  dropId: number;
  migratedReviews: number;
  droppedConflictingReviews: number;
};

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function mergeAlbums(
  prisma: PrismaClient,
  keepId: number,
  dropId: number,
): Promise<MergeAlbumsResult> {
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
    throw new Error("IDs de álbum inválidos");
  }

  return prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.album.findUnique({ where: { id: keepId }, select: { id: true, title: true, spotifyId: true } }),
      tx.album.findUnique({ where: { id: dropId }, select: { id: true, title: true, spotifyId: true } }),
    ]);
    if (!keep || !drop) throw new Error("Álbum não encontrado");

    await migrateSpotifyRelations(tx, keep.spotifyId, keep.title, drop.spotifyId);
    const { migratedReviews, droppedConflictingReviews } = await migrateReviews(tx, keep.id, drop.id);
    await migrateAlbumClubNominations(tx, keep.id, drop.id);
    await migrateWeeklyReleaseAlbums(tx, keep.id, drop.id);

    await tx.album.delete({ where: { id: drop.id } });

    return { keepId: keep.id, dropId: drop.id, migratedReviews, droppedConflictingReviews };
  });
}

async function migrateSpotifyRelations(
  tx: Tx,
  keepSpotifyId: string,
  keepTitle: string,
  dropSpotifyId: string,
) {
  await tx.song.updateMany({
    where: { albumSpotifyId: dropSpotifyId },
    data: { albumSpotifyId: keepSpotifyId, album: keepTitle },
  });
  await tx.chartEntry.updateMany({
    where: { albumSpotifyId: dropSpotifyId },
    data: { albumSpotifyId: keepSpotifyId },
  });
}

async function migrateReviews(tx: Tx, keepId: number, dropId: number) {
  const [dropReviews, keepReviewerIds] = await Promise.all([
    tx.albumReview.findMany({ where: { albumId: dropId }, select: { id: true, userId: true } }),
    tx.albumReview.findMany({ where: { albumId: keepId }, select: { userId: true } }),
  ]);
  const keepUserSet = new Set(keepReviewerIds.map((r) => r.userId));
  const reviewIdsToMigrate = dropReviews.filter((r) => !keepUserSet.has(r.userId)).map((r) => r.id);
  const droppedConflictingReviews = dropReviews.length - reviewIdsToMigrate.length;

  if (reviewIdsToMigrate.length > 0) {
    await tx.albumReview.updateMany({
      where: { id: { in: reviewIdsToMigrate } },
      data: { albumId: keepId },
    });
  }

  return { migratedReviews: reviewIdsToMigrate.length, droppedConflictingReviews };
}

async function migrateAlbumClubNominations(tx: Tx, keepId: number, dropId: number) {
  const dropNominations = await tx.albumClubNomination.findMany({
    where: { albumId: dropId },
    select: { id: true, roundId: true, userId: true },
  });
  if (dropNominations.length === 0) return;

  const keepNominations = await tx.albumClubNomination.findMany({
    where: { albumId: keepId },
    select: { roundId: true, userId: true },
  });
  const keepKeys = new Set(keepNominations.map((n) => `${n.roundId}:${n.userId}`));

  for (const nom of dropNominations) {
    const key = `${nom.roundId}:${nom.userId}`;
    if (keepKeys.has(key)) {
      await tx.albumClubNomination.delete({ where: { id: nom.id } });
      continue;
    }
    await tx.albumClubNomination.update({
      where: { id: nom.id },
      data: { albumId: keepId },
    });
    keepKeys.add(key);
  }
}

async function migrateWeeklyReleaseAlbums(tx: Tx, keepId: number, dropId: number) {
  const dropRows = await tx.weeklyReleaseAlbum.findMany({
    where: { albumId: dropId },
    select: { id: true, weeklyReleaseId: true },
  });
  if (dropRows.length === 0) return;

  const keepRows = await tx.weeklyReleaseAlbum.findMany({
    where: { albumId: keepId },
    select: { weeklyReleaseId: true },
  });
  const keepWeeks = new Set(keepRows.map((r) => r.weeklyReleaseId));

  for (const row of dropRows) {
    if (keepWeeks.has(row.weeklyReleaseId)) {
      await tx.weeklyReleaseAlbum.delete({ where: { id: row.id } });
      continue;
    }
    await tx.weeklyReleaseAlbum.update({
      where: { id: row.id },
      data: { albumId: keepId },
    });
    keepWeeks.add(row.weeklyReleaseId);
  }
}
