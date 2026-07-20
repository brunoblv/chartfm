/**
 * Preenche capas de músicas que têm spotifyId mas não têm álbum/capa no banco.
 *
 * Uso:
 *   npx tsx scripts/backfill-song-covers.ts --dry-run
 *   npx tsx scripts/backfill-song-covers.ts
 *   npx tsx scripts/backfill-song-covers.ts --limit=50
 *   npx tsx scripts/backfill-song-covers.ts --search   # também busca por título/artista (lento; risco de 429)
 *   npx tsx scripts/backfill-song-covers.ts --delay-ms=3000
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
import { isSpotifyTrackId, waitForSpotifyApi } from "../lib/spotify-server";
import {
  enrichSongsWithSpotifyMetadataByIds,
  findSongsMissingCovers,
} from "../lib/resolve-publish-songs";
import { runWithSpotifyBackfillPool } from "../lib/spotify-user-charts-pool";

const DRY_RUN = process.argv.includes("--dry-run");
const SEARCH_FALLBACK = process.argv.includes("--search");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const DELAY_ARG = process.argv.find((a) => a.startsWith("--delay-ms="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : undefined;
const DELAY_MS = DELAY_ARG ? Math.max(0, Number(DELAY_ARG.split("=")[1]) || 0) : 2_500;
const BATCH_SIZE = SEARCH_FALLBACK ? 20 : 15;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  return runWithSpotifyBackfillPool(() => run());
}

async function run() {
  const allCandidates = await findSongsMissingCovers(prisma, LIMIT);
  const withValidSpotifyId = allCandidates.filter((r) => r.spotifyId && isSpotifyTrackId(r.spotifyId));
  const invalidIds = allCandidates.filter((r) => r.spotifyId && !isSpotifyTrackId(r.spotifyId));
  const withoutSpotifyId = allCandidates.filter((r) => !r.spotifyId);

  const candidates = SEARCH_FALLBACK ? allCandidates : withValidSpotifyId;

  console.log(`Músicas sem capa: ${allCandidates.length}`);
  if (withValidSpotifyId.length > 0) {
    console.log(`  → ${withValidSpotifyId.length} com spotifyId válido (processáveis agora)`);
  }
  if (invalidIds.length > 0) {
    console.log(`  → ${invalidIds.length} com ID inválido (não é faixa Spotify de 22 chars)`);
  }
  if (withoutSpotifyId.length > 0) {
    console.log(`  → ${withoutSpotifyId.length} sem spotifyId${SEARCH_FALLBACK ? " (incluídas com --search)" : " (use --search para tentar busca por título)"}`);
  }

  if (candidates.length === 0) {
    console.log("Nada a fazer.");
    return;
  }

  if (DRY_RUN) {
    const probe = await waitForSpotifyApi({ maxWaitMs: 60_000 });
    console.log(probe.ok ? "\nSpotify API: OK" : `\nSpotify API: FALHOU — ${probe.error}`);
    console.log("\nAmostra (dry-run):");
    for (const row of candidates.slice(0, 20)) {
      const idTag = row.spotifyId && !isSpotifyTrackId(row.spotifyId) ? "ID inválido" : row.spotifyId ? "ID ok" : "sem ID";
      console.log(`  - ${row.artist} — ${row.title} (${row.spotifyId ?? "—"}) [${idTag}]`);
    }
    if (candidates.length > 20) {
      console.log(`  ... e mais ${candidates.length - 20}`);
    }
    console.log("\nExecute sem --dry-run para aplicar.");
    if (!SEARCH_FALLBACK && withoutSpotifyId.length > 0) {
      console.log("Dica: só IDs Spotify válidos são processados por padrão (evita rate limit 429).");
    }
    return;
  }

  console.log(`\nAguardando Spotify ficar disponível (até 3 min)...`);
  const probe = await waitForSpotifyApi({ maxWaitMs: 180_000 });
  if (!probe.ok) {
    console.error(`\nErro: ${probe.error}`);
    if (probe.status === 429) {
      console.error("Rate limit ainda ativo. Tente de novo em alguns minutos ou aguarde o retry-after do Spotify.");
    } else {
      console.error("Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env do servidor.");
    }
    process.exit(1);
  }
  console.log("Spotify API: OK\n");

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalViaSearch = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const ids = batch.map((r) => r.id);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batchTotal = Math.ceil(candidates.length / BATCH_SIZE);
    process.stdout.write(`Lote ${batchNum}/${batchTotal} (${ids.length} músicas) ... `);

    const result = await enrichSongsWithSpotifyMetadataByIds(prisma, ids, {
      searchFallback: SEARCH_FALLBACK,
    });
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

    if (i + BATCH_SIZE < candidates.length && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  console.log(
    `\nConcluído: ${totalUpdated} músicas enriquecidas, ${totalSkipped} ignoradas (${totalViaSearch} via busca por título/artista).`,
  );

  const remaining = await findSongsMissingCovers(prisma);
  if (remaining.length > 0) {
    console.log(`\nAinda sem capa (${remaining.length}):`);
    const show = remaining.slice(0, 30);
    for (const row of show) {
      const idNote = row.spotifyId
        ? isSpotifyTrackId(row.spotifyId)
          ? `spotify:${row.spotifyId}`
          : `id inválido:${row.spotifyId}`
        : "sem spotifyId";
      console.log(`  - ${row.artist} — ${row.title} (${idNote})`);
    }
    if (remaining.length > show.length) {
      console.log(`  ... e mais ${remaining.length - show.length}`);
    }
    if (!SEARCH_FALLBACK && remaining.some((r) => !r.spotifyId || !isSpotifyTrackId(r.spotifyId ?? ""))) {
      console.log("\nPara as restantes sem spotifyId válido, rode depois com --search (devagar, ex.: --delay-ms=5000).");
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
