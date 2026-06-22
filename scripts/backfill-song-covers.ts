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

import { prisma } from "../lib/prisma";
import { isSpotifyTrackId, probeSpotifyApi } from "../lib/spotify-server";
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
  const invalidIds = candidates.filter((r) => r.spotifyId && !isSpotifyTrackId(r.spotifyId));
  console.log(`Músicas sem capa (com Spotify ID): ${candidates.length}`);
  if (invalidIds.length > 0) {
    console.log(`  → ${invalidIds.length} com ID inválido (não é faixa Spotify de 22 chars)`);
  }

  if (candidates.length === 0) {
    console.log("Nada a fazer.");
    return;
  }

  if (DRY_RUN) {
    const probe = await probeSpotifyApi();
    console.log(probe.ok ? "\nSpotify API: OK" : `\nSpotify API: FALHOU — ${probe.error}`);
    console.log("\nAmostra (dry-run):");
    for (const row of candidates.slice(0, 20)) {
      const idTag = row.spotifyId && !isSpotifyTrackId(row.spotifyId) ? "ID inválido" : "ID ok";
      console.log(`  - ${row.artist} — ${row.title} (${row.spotifyId}) [${idTag}]`);
    }
    if (candidates.length > 20) {
      console.log(`  ... e mais ${candidates.length - 20}`);
    }
    console.log("\nExecute sem --dry-run para aplicar.");
    return;
  }

  const probe = await probeSpotifyApi();
  if (!probe.ok) {
    console.error(`\nErro: ${probe.error}`);
    console.error("Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env do servidor.");
    process.exit(1);
  }
  console.log("Spotify API: OK\n");

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalViaSearch = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const ids = batch.map((r) => r.id);
    process.stdout.write(
      `Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)} (${ids.length} músicas) ... `,
    );

    const result = await enrichSongsWithSpotifyMetadataByIds(prisma, ids, { searchFallback: true });
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    totalViaSearch += result.viaSearch;

    if (result.tokenMissing) {
      console.log("falhou (sem token Spotify)");
      console.error("\nToken Spotify perdido durante o processamento. Interrompa e verifique o .env.");
      process.exit(1);
    }

    console.log(
      `ok (${result.updated} com capa, ${result.skipped} sem match; busca: ${result.viaSearch})`,
    );
  }

  console.log(
    `\nConcluído: ${totalUpdated} músicas enriquecidas, ${totalSkipped} ignoradas (${totalViaSearch} via busca por título/artista).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
