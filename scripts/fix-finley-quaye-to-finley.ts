/**
 * Reatribui músicas de "Finley Quaye" para "Finley" no BD,
 * remapeando também as entradas de paradas quando existir song duplicada por título.
 *
 * Uso:
 *   npx tsx scripts/fix-finley-quaye-to-finley.ts --dry-run
 *   npx tsx scripts/fix-finley-quaye-to-finley.ts
 */

import { prisma } from "../lib/prisma";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const wrongSongs = await prisma.song.findMany({
    where: { artist: { equals: "Finley Quaye", mode: "insensitive" } },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    orderBy: { id: "asc" },
  });

  console.log(`wrong_songs=${wrongSongs.length} dry_run=${dryRun}`);

  let merged = 0;
  let renamed = 0;
  let skipped = 0;
  let failed = 0;

  for (const wrong of wrongSongs) {
    const sameTitleFinley = await prisma.song.findFirst({
      where: {
        artist: { equals: "Finley", mode: "insensitive" },
        title: { equals: wrong.title, mode: "insensitive" },
      },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    });

    if (sameTitleFinley && sameTitleFinley.id !== wrong.id) {
      if (dryRun) {
        const refs = await prisma.chartEntry.count({ where: { songId: wrong.id } });
        console.log("DRY merge", {
          title: wrong.title,
          fromSongId: wrong.id,
          toSongId: sameTitleFinley.id,
          chartEntries: refs,
        });
      } else {
        await prisma.chartEntry.updateMany({
          where: { songId: wrong.id },
          data: {
            songId: sameTitleFinley.id,
            songSpotifyId: sameTitleFinley.spotifyId ?? null,
            albumSpotifyId: sameTitleFinley.albumSpotifyId ?? null,
          },
        });

        const refsLeft = await prisma.chartEntry.count({ where: { songId: wrong.id } });
        if (refsLeft === 0) {
          await prisma.song.delete({ where: { id: wrong.id } });
        }
      }
      merged += 1;
      continue;
    }

    // Sem duplicata por título: apenas corrige o texto do artista.
    // Proteção: só reatribui quando o título parece não ambíguo no catálogo local.
    const ambiguous = await prisma.song.count({
      where: {
        title: { equals: wrong.title, mode: "insensitive" },
        NOT: { id: wrong.id },
      },
    });

    if (ambiguous > 0 && normalize(wrong.title) !== "sunday shining") {
      console.log("SKIP ambiguous", { songId: wrong.id, title: wrong.title, ambiguous });
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log("DRY rename", { songId: wrong.id, title: wrong.title, from: wrong.artist, to: "Finley" });
    } else {
      try {
        await prisma.song.update({
          where: { id: wrong.id },
          data: { artist: "Finley" },
        });
      } catch (e) {
        console.log("FAIL rename", { songId: wrong.id, title: wrong.title, error: String(e) });
        failed += 1;
        continue;
      }
    }
    renamed += 1;
  }

  console.log(JSON.stringify({ merged, renamed, skipped, failed, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
