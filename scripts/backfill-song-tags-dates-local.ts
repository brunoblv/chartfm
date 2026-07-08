/**
 * Preenche recording_mbid, genres (tags MB) e datas de lançamento usando SOMENTE o
 * Postgres local do MusicBrainz — sem chamar Last.fm/YouTube/WS, para não gerar tráfego
 * em APIs externas.
 *
 * Pré-requisitos:
 *   1. MusicBrainz Docker rodando (db-only-mirror) na porta 5432
 *   2. DATABASE_URL apontando para o banco alvo (produção via túnel SSH, ou local)
 *
 * Uso:
 *   npx tsx scripts/backfill-song-tags-dates-local.ts --dry-run
 *   npx tsx scripts/backfill-song-tags-dates-local.ts
 *   npx tsx scripts/backfill-song-tags-dates-local.ts --limit=100
 *   npx tsx scripts/backfill-song-tags-dates-local.ts --only-both   (padrão: só sem tags E sem data)
 *   npx tsx scripts/backfill-song-tags-dates-local.ts --any-missing (sem tags OU sem data)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  closeMusicBrainzPool,
  getMusicBrainzPool,
  getMusicBrainzReleaseDatesFromLocalDb,
  getRecordingTagsFromLocalDb,
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
const ANY_MISSING = process.argv.includes("--any-missing");
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
    throw new Error("MusicBrainz local sem tabelas — suba o docker-compose antes.");
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log("Chartify DB:", dbUrl.replace(/:[^:@/]+@/, ":***@"));
  console.log(
    "MusicBrainz local:",
    process.env.MUSICBRAINZ_DATABASE_URL ?? "postgresql://musicbrainz:***@127.0.0.1:5432/musicbrainz_db",
  );
  console.log(`Modo: ${DRY_RUN ? "dry-run" : "gravar"} | filtro: ${ANY_MISSING ? "sem tags OU sem data" : "sem tags E sem data"}\n`);

  await verifyMusicBrainzConnection();

  const missingTags: Prisma.SongWhereInput = { genres: { isEmpty: true } };
  const missingDates: Prisma.SongWhereInput = {
    singleReleaseDate: null,
    musicVideoReleaseDate: null,
  };

  const where: Prisma.SongWhereInput = ANY_MISSING
    ? { OR: [missingTags, missingDates] }
    : { AND: [missingTags, missingDates] };

  const songs = await prisma.song.findMany({
    where,
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      isrc: true,
      recordingMbid: true,
      genres: true,
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

  let mbidFound = 0;
  let tagsFound = 0;
  let datesFound = 0;
  let updated = 0;
  let noMbid = 0;
  const startedAt = Date.now();

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]!;

    const resolved = await resolveRecordingMbidFromLocalDb({
      title: song.title,
      artist: song.artist,
      spotifyId: song.spotifyId,
      isrc: song.isrc,
      recordingMbid: song.recordingMbid,
    });

    if (!resolved) {
      noMbid += 1;
      continue;
    }
    mbidFound += 1;
    const mbid = resolved.mbid;

    const needsTags = !song.genres?.length;
    const needsDates = !song.singleReleaseDate && !song.musicVideoReleaseDate;

    const [tagsResult, dates] = await Promise.all([
      needsTags ? getRecordingTagsFromLocalDb(mbid) : Promise.resolve(null),
      needsDates
        ? getMusicBrainzReleaseDatesFromLocalDb(mbid, { title: song.title, artist: song.artist })
        : Promise.resolve({ singleReleaseDate: null, musicVideoReleaseDate: null }),
    ]);

    const tags = tagsResult?.tags ?? [];
    if (tags.length) tagsFound += 1;
    if (dates.singleReleaseDate || dates.musicVideoReleaseDate) datesFound += 1;

    const data: Prisma.SongUpdateInput = {
      recordingMbid: mbid,
      ...(tags.length ? { genres: tags, genreSource: "musicbrainz", genresFetchedAt: new Date() } : {}),
      ...(dates.singleReleaseDate ? { singleReleaseDate: dates.singleReleaseDate } : {}),
      ...(dates.musicVideoReleaseDate ? { musicVideoReleaseDate: dates.musicVideoReleaseDate } : {}),
      singleReleaseDateFetchedAt: new Date(),
      releaseDatesVersion: 4,
    };

    const line = `  ${DRY_RUN ? "→" : "✓"} ${song.artist} — ${song.title} | mbid:${resolved.source} | tags:[${tags.join(", ")}] | single:${fmt(dates.singleReleaseDate)} | clipe:${fmt(dates.musicVideoReleaseDate)}`;
    console.log(line);

    if (!DRY_RUN) {
      await prisma.song.update({ where: { id: song.id }, data });
    }
    updated += 1;

    if ((i + 1) % 200 === 0) {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      console.log(`  … ${i + 1}/${songs.length} processadas (${elapsedSec.toFixed(0)}s)`);
    }
  }

  console.log("\n--- Resumo ---");
  console.log(`Processadas: ${songs.length}`);
  console.log(`MBID encontrado: ${mbidFound}`);
  console.log(`Sem MBID (não deu para buscar tags/data): ${noMbid}`);
  console.log(`Tags encontradas no MB: ${tagsFound}`);
  console.log(`Datas encontradas no MB: ${datesFound}`);
  console.log(`${DRY_RUN ? "Seriam atualizadas" : "Atualizadas"}: ${updated}`);
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
