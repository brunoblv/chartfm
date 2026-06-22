/**
 * Preenche capas de músicas que têm spotifyId mas não têm álbum/capa no banco.
 *
 * Uso:
 *   npx tsx scripts/backfill-song-covers.ts --dry-run
 *   npx tsx scripts/backfill-song-covers.ts
 *   npx tsx scripts/backfill-song-covers.ts --limit=50
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
import {
  enrichSongsWithSpotifyMetadataByIds,
  findSongsMissingCovers,
} from "../lib/resolve-publish-songs";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : undefined;
const BATCH_SIZE = 100;

async function main() {
  const candidates = await findSongsMissingCovers(prisma, LIMIT);
  console.log(`Músicas sem capa (com Spotify ID): ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("Nada a fazer.");
    return;
  }

  if (DRY_RUN) {
    console.log("\nAmostra (dry-run):");
    for (const row of candidates.slice(0, 20)) {
      console.log(`  - ${row.artist} — ${row.title} (${row.spotifyId})`);
    }
    if (candidates.length > 20) {
      console.log(`  ... e mais ${candidates.length - 20}`);
    }
    console.log("\nExecute sem --dry-run para aplicar.");
    return;
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const ids = batch.map((r) => r.id);
    process.stdout.write(
      `Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)} (${ids.length} músicas) ... `,
    );

    const { updated, skipped } = await enrichSongsWithSpotifyMetadataByIds(prisma, ids);
    totalUpdated += updated;
    totalSkipped += skipped;
    console.log(`ok (${updated} com capa, ${skipped} sem resposta do Spotify)`);
  }

  console.log(`\nConcluído: ${totalUpdated} músicas enriquecidas, ${totalSkipped} ignoradas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
