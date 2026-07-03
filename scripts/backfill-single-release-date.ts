/**
 * Preenche single_release_date e music_video_release_date usando o Postgres local do MusicBrainz.
 *
 * Pré-requisitos:
 *   1. MUSICBRAINZ_DATABASE_URL (ou Docker local na 5432)
 *   2. Músicas com recording_mbid já preenchido
 *
 * Uso:
 *   npx tsx scripts/backfill-single-release-date.ts --dry-run
 *   npx tsx scripts/backfill-single-release-date.ts
 *   npx tsx scripts/backfill-single-release-date.ts --limit=100
 *   npx tsx scripts/backfill-single-release-date.ts --force
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  closeMusicBrainzPool,
  getMusicBrainzPool,
  getMusicBrainzReleaseDatesFromLocalDb,
} from "../lib/musicbrainz-local";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

for (const name of [".env", ".env.local", ".env.production"]) {
  loadEnvFile(join(process.cwd(), name));
}

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : undefined;

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

async function verifyMusicBrainzConnection(): Promise<void> {
  const pool = getMusicBrainzPool();
  const row = await pool.query<{ ok: number }>(
    "SELECT count(*)::int AS ok FROM musicbrainz.recording LIMIT 1",
  );
  if (!row.rows[0]?.ok) {
    throw new Error("MusicBrainz local sem tabelas — rode createdb.sh antes.");
  }
}

async function main() {
  console.log(
    "MusicBrainz local:",
    process.env.MUSICBRAINZ_DATABASE_URL ?? "postgresql://musicbrainz:***@127.0.0.1:5432/musicbrainz_db",
  );
  console.log(`Modo: ${DRY_RUN ? "dry-run" : "gravar"}${FORCE ? " | force" : ""}\n`);

  await verifyMusicBrainzConnection();

  const where: Prisma.SongWhereInput = {
    recordingMbid: { not: null },
    ...(FORCE
      ? {}
      : {
          OR: [{ singleReleaseDate: null }, { musicVideoReleaseDate: null }],
        }),
  };

  const songs = await prisma.song.findMany({
    where,
    select: {
      id: true,
      title: true,
      artist: true,
      recordingMbid: true,
      singleReleaseDate: true,
      musicVideoReleaseDate: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`Músicas a processar: ${songs.length}`);
  if (!songs.length) {
    console.log("Nada a fazer.");
    return;
  }

  let found = 0;
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const song of songs) {
    const mbid = song.recordingMbid?.trim();
    if (!mbid) continue;

    const dates = await getMusicBrainzReleaseDatesFromLocalDb(mbid, {
      title: song.title,
      artist: song.artist,
    });

    if (!dates.singleReleaseDate && !dates.musicVideoReleaseDate) {
      notFound += 1;
      console.log(`  ✗ ${song.artist} — ${song.title}`);
      continue;
    }

    found += 1;

    const sameSingle =
      (song.singleReleaseDate?.toISOString().slice(0, 10) ?? null) ===
      (dates.singleReleaseDate?.toISOString().slice(0, 10) ?? null);
    const sameVideo =
      (song.musicVideoReleaseDate?.toISOString().slice(0, 10) ?? null) ===
      (dates.musicVideoReleaseDate?.toISOString().slice(0, 10) ?? null);

    if (!FORCE && sameSingle && sameVideo) {
      skipped += 1;
      continue;
    }

    const line = `  ${DRY_RUN ? "→" : "✓"} ${song.artist} — ${song.title} | single: ${fmt(dates.singleReleaseDate)} | clipe: ${fmt(dates.musicVideoReleaseDate)}`;

    if (DRY_RUN) {
      console.log(line);
      updated += 1;
      continue;
    }

    await prisma.song.update({
      where: { id: song.id },
      data: {
        ...(dates.singleReleaseDate != null ? { singleReleaseDate: dates.singleReleaseDate } : {}),
        ...(dates.musicVideoReleaseDate != null
          ? { musicVideoReleaseDate: dates.musicVideoReleaseDate }
          : {}),
        singleReleaseDateFetchedAt: new Date(),
        releaseDatesVersion: 4,
      },
    });
    updated += 1;
    console.log(line);
  }

  console.log("\n--- Resumo ---");
  console.log(`Processadas: ${songs.length}`);
  console.log(`Com data no MB: ${found}`);
  console.log(`${DRY_RUN ? "Seriam atualizadas" : "Atualizadas"}: ${updated}`);
  console.log(`Já corretas (skip): ${skipped}`);
  console.log(`Sem data de single: ${notFound}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeMusicBrainzPool();
    await prisma.$disconnect();
  });
