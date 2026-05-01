/**
 * Sincroniza capas legadas de Song.coverImageUrl para Album.coverUrl.
 *
 * Regra:
 * - Só considera músicas com albumSpotifyId e coverImageUrl preenchidos.
 * - Só atualiza álbum com coverUrl vazio.
 * - Fonte única final: Album.coverUrl.
 *
 * Uso:
 *   npx tsx scripts/sync-album-covers-from-song.ts
 *   npx tsx scripts/sync-album-covers-from-song.ts --dry-run
 */

import { prisma } from "../lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const songs = await prisma.song.findMany({
    where: {
      albumSpotifyId: { not: null },
      coverImageUrl: { not: null },
      albumRef: {
        OR: [{ coverUrl: null }, { coverUrl: "" }],
      },
    },
    select: {
      albumSpotifyId: true,
      coverImageUrl: true,
    },
  });

  const chosenByAlbum = new Map<string, string>();
  for (const row of songs) {
    const albumSpotifyId = row.albumSpotifyId?.trim();
    const cover = row.coverImageUrl?.trim();
    if (!albumSpotifyId || !cover) continue;
    if (!chosenByAlbum.has(albumSpotifyId)) chosenByAlbum.set(albumSpotifyId, cover);
  }

  let updated = 0;
  for (const [albumSpotifyId, coverUrl] of chosenByAlbum.entries()) {
    if (!dryRun) {
      const res = await prisma.album.updateMany({
        where: {
          spotifyId: albumSpotifyId,
          OR: [{ coverUrl: null }, { coverUrl: "" }],
        },
        data: { coverUrl },
      });
      updated += res.count;
    } else {
      updated += 1;
    }
  }

  console.log(
    JSON.stringify({
      dryRun,
      candidateSongs: songs.length,
      candidateAlbums: chosenByAlbum.size,
      updatedAlbums: updated,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
