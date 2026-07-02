/**
 * Preenche recording_mbid em "Song" usando o Postgres local do MusicBrainz.
 *
 * Pré-requisitos:
 *   1. SSH túnel VPS: ssh -L 5433:127.0.0.1:5432 usuario@VPS
 *   2. DATABASE_URL apontando para a VPS (ex.: 127.0.0.1:5433)
 *   3. MusicBrainz Docker rodando na 5432
 *
 * Uso:
 *   npx tsx scripts/backfill-recording-mbid.ts --dry-run
 *   npx tsx scripts/backfill-recording-mbid.ts
 *   npx tsx scripts/backfill-recording-mbid.ts --limit=100
 *   npx tsx scripts/backfill-recording-mbid.ts --force
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  closeMusicBrainzPool,
  getMusicBrainzPool,
  resolveRecordingMbidFromLocalDb,
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
  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log("Chartify (VPS/túnel):", dbUrl.replace(/:[^:@/]+@/, ":***@"));
  console.log(
    "MusicBrainz local:",
    (process.env.MUSICBRAINZ_DATABASE_URL ?? "postgresql://musicbrainz:***@127.0.0.1:5432/musicbrainz_db"),
  );
  console.log(`Modo: ${DRY_RUN ? "dry-run" : "gravar"}${FORCE ? " | force" : ""}\n`);

  await verifyMusicBrainzConnection();

  const where: Prisma.SongWhereInput = FORCE
    ? {}
    : {
        OR: [{ recordingMbid: null }, { recordingMbid: "" }],
      };

  const songs = await prisma.song.findMany({
    where,
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      isrc: true,
      recordingMbid: true,
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
    const resolved = await resolveRecordingMbidFromLocalDb({
      title: song.title,
      artist: song.artist,
      spotifyId: song.spotifyId,
      isrc: song.isrc,
      recordingMbid: FORCE ? null : song.recordingMbid,
    });

    if (!resolved) {
      notFound += 1;
      console.log(`  ✗ ${song.artist} — ${song.title}`);
      continue;
    }

    found += 1;

    if (!FORCE && song.recordingMbid === resolved.mbid) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  → ${song.artist} — ${song.title} | ${resolved.source} | ${resolved.mbid}`,
      );
      updated += 1;
      continue;
    }

    await prisma.song.update({
      where: { id: song.id },
      data: { recordingMbid: resolved.mbid },
    });
    updated += 1;
    console.log(
      `  ✓ ${song.artist} — ${song.title} | ${resolved.source} | ${resolved.mbid}`,
    );
  }

  console.log("\n--- Resumo ---");
  console.log(`Processadas: ${songs.length}`);
  console.log(`Encontradas no MB: ${found}`);
  console.log(`${DRY_RUN ? "Seriam atualizadas" : "Atualizadas"}: ${updated}`);
  console.log(`Já corretas (skip): ${skipped}`);
  console.log(`Não encontradas: ${notFound}`);
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
