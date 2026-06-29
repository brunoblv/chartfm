/**
 * Unifica duas faixas Taylor Swift — mantém 5uPaqMMt59KGrdKIitDRqa.
 * Uso: npx tsx scripts/merge-songs.ts <keepSpotifyId> <dropSpotifyId>
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { prisma } from "../lib/prisma";

const KEEP_SPOTIFY = process.argv[2] ?? "5uPaqMMt59KGrdKIitDRqa";
const DROP_SPOTIFY = process.argv[3] ?? "4cHQ0okN97O3vqAqRN9Osu";

async function mergeSongs(keepSpotifyId: string, dropSpotifyId: string) {
  const [keep, drop] = await Promise.all([
    prisma.song.findUnique({
      where: { spotifyId: keepSpotifyId },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        albumSpotifyId: true,
        artistSpotifyId: true,
        _count: { select: { entries: true } },
      },
    }),
    prisma.song.findUnique({
      where: { spotifyId: dropSpotifyId },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        albumSpotifyId: true,
        artistSpotifyId: true,
        _count: { select: { entries: true } },
      },
    }),
  ]);

  if (!keep) throw new Error(`Música keep não encontrada: ${keepSpotifyId}`);
  if (!drop) throw new Error(`Música drop não encontrada: ${dropSpotifyId}`);

  console.log("KEEP:", keep.title, "—", keep.artist, `(${keep._count.entries} entries)`);
  console.log("DROP:", drop.title, "—", drop.artist, `(${drop._count.entries} entries)`);

  const dropEntries = await prisma.chartEntry.findMany({
    where: { songId: drop.id },
    select: { id: true, chartId: true, position: true },
  });

  const conflicts = await prisma.chartEntry.findMany({
    where: {
      songId: keep.id,
      chartId: { in: dropEntries.map((e) => e.chartId) },
    },
    select: { chartId: true, position: true },
  });

  if (conflicts.length > 0) {
    console.log(`\nAtenção: ${conflicts.length} parada(s) com as duas faixas — removendo entradas duplicadas do drop.`);
  }

  await prisma.$transaction(async (tx) => {
    const targetSpotifyId = keep.spotifyId!;

    for (const entry of dropEntries) {
      const existingKeep = await tx.chartEntry.findFirst({
        where: { chartId: entry.chartId, songId: keep.id },
      });
      if (existingKeep) {
        await tx.chartEntry.delete({ where: { id: entry.id } });
        continue;
      }
      await tx.chartEntry.update({
        where: { id: entry.id },
        data: { songId: keep.id, songSpotifyId: targetSpotifyId },
      });
    }

    await tx.chartEntry.updateMany({
      where: { songSpotifyId: drop.spotifyId },
      data: { songSpotifyId: targetSpotifyId },
    });

    await tx.songVideoClip.updateMany({ where: { songId: drop.id }, data: { songId: keep.id } });

    const dropChoices = await tx.userSongVideoClipChoice.findMany({ where: { songId: drop.id } });
    for (const choice of dropChoices) {
      const exists = await tx.userSongVideoClipChoice.findUnique({
        where: { userId_songId: { userId: choice.userId, songId: keep.id } },
      });
      if (exists) await tx.userSongVideoClipChoice.delete({ where: { userId_songId: { userId: choice.userId, songId: drop.id } } });
      else await tx.userSongVideoClipChoice.update({ where: { userId_songId: { userId: choice.userId, songId: drop.id } }, data: { songId: keep.id } });
    }

    await tx.songRecommendation.updateMany({ where: { songId: drop.id }, data: { songId: keep.id } });
    await tx.pushSubmission.updateMany({ where: { songId: drop.id }, data: { songId: keep.id } });
    await tx.copaSingle.updateMany({ where: { songId: drop.id }, data: { songId: keep.id } });

    if (drop.spotifyId && targetSpotifyId !== drop.spotifyId) {
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

    await tx.song.delete({ where: { id: drop.id } });
  });

  const after = await prisma.song.findUnique({
    where: { id: keep.id },
    select: { id: true, title: true, spotifyId: true, _count: { select: { entries: true } } },
  });

  console.log("\nMerge concluído.");
  console.log("Principal:", after?.title, "| entries:", after?._count.entries);
  console.log("URL:", `/song/${after?.spotifyId}_i-knew-it-i-knew-you_taylor-swift`);
}

mergeSongs(KEEP_SPOTIFY, DROP_SPOTIFY).catch((e) => {
  console.error(e);
  process.exit(1);
});
