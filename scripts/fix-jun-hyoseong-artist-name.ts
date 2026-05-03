/**
 * Corrige o nome de artista importado por engano: "Jun Hyoseong" → "Jun Hyo Seong".
 *
 * - Se já existir `Song` com o mesmo `title` e artista canónico, faz merge:
 *   `ChartEntry` apontam para a canónica e a duplicata é removida.
 * - Caso contrário, só atualiza o campo `artist`.
 * - Atualiza `artists.name` quando `spotify_id` for o dela e o nome for o typo.
 *
 * Uso:
 *   npx tsx scripts/fix-jun-hyoseong-artist-name.ts --dry-run
 *   npx tsx scripts/fix-jun-hyoseong-artist-name.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const WRONG = "Jun Hyoseong";
const CORRECT = "Jun Hyo Seong";
const SPOTIFY_ARTIST_ID = "73RRzEpK7IQexOhC0CuTRZ";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun && apply) {
    console.error("Use só --dry-run ou só --apply");
    process.exit(1);
  }
  if (!dryRun && !apply) {
    console.error("Indique --dry-run ou --apply");
    process.exit(1);
  }

  const wrongSongs = await prisma.song.findMany({
    where: { artist: { equals: WRONG, mode: Prisma.QueryMode.insensitive } },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumSpotifyId: true,
    },
  });

  let renamed = 0;
  let merged = 0;
  let entriesMoved = 0;
  let dupDeleted = 0;
  const log: unknown[] = [];

  for (const dup of wrongSongs) {
    const canon = await prisma.song.findUnique({
      where: { title_artist: { title: dup.title, artist: CORRECT } },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    });

    if (canon && canon.id !== dup.id) {
      const nEntries = await prisma.chartEntry.count({ where: { songId: dup.id } });
      log.push({
        merge: true,
        dup: { id: dup.id, title: dup.title, artist: dup.artist },
        canon: { id: canon.id, title: canon.title, artist: canon.artist },
        chartEntries: nEntries,
      });
      if (apply) {
        const songSpotifyId = canon.spotifyId?.trim() || null;
        const albumSpotifyId = canon.albumSpotifyId?.trim() || dup.albumSpotifyId?.trim() || null;
        await prisma.$transaction(async (tx) => {
          const up = await tx.chartEntry.updateMany({
            where: { songId: dup.id },
            data: { songId: canon.id, songSpotifyId, albumSpotifyId },
          });
          entriesMoved += up.count;
          const left = await tx.chartEntry.count({ where: { songId: dup.id } });
          if (left === 0) {
            await tx.song.delete({ where: { id: dup.id } });
            dupDeleted += 1;
          }
        });
        merged += 1;
      } else {
        entriesMoved += nEntries;
        merged += 1;
      }
      continue;
    }

    log.push({ rename: true, id: dup.id, title: dup.title, from: dup.artist, to: CORRECT });
    if (apply) {
      await prisma.song.update({
        where: { id: dup.id },
        data: { artist: CORRECT },
      });
      renamed += 1;
    } else {
      renamed += 1;
    }
  }

  let artistsUpdated = 0;
  const artistRows = await prisma.artist.findMany({
    where: {
      spotifyId: SPOTIFY_ARTIST_ID,
      name: { equals: WRONG, mode: Prisma.QueryMode.insensitive },
    },
    select: { id: true, spotifyId: true, name: true },
  });
  for (const a of artistRows) {
    log.push({ artistRow: a, setName: CORRECT });
    if (apply) {
      await prisma.artist.update({
        where: { id: a.id },
        data: { name: CORRECT },
      });
    }
    artistsUpdated += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        apply,
        wrongSongRows: wrongSongs.length,
        songsRenamed: renamed,
        songsMerged: merged,
        chartEntriesMoved: entriesMoved,
        dupSongsDeleted: apply ? dupDeleted : 0,
        artistRowsMatched: artistRows.length,
        artistsNameFixed: artistsUpdated,
        details: log,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
