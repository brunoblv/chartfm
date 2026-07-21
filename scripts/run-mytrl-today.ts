/**
 * MyTRL diária (@bruno) — roda manualmente a parada de um dia específico
 * (top 10 → UMS Request Live) quando o cron não rodou automaticamente.
 *
 * Usa a playlist Spotify já gravada no perfil @bruno (spotifyNewHitsPlaylistId).
 *
 * Usage:
 *   npx tsx scripts/run-mytrl-today.ts
 *   npx tsx scripts/run-mytrl-today.ts --date=2026-07-14
 *   npx tsx scripts/run-mytrl-today.ts --date=2026-07-14 --dry-run
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
import { parseMyTrlReferenceDate } from "../lib/mytrl-chart-engine";
import { runDailyMyTrlJob } from "../lib/mytrl-daily-parada";
import { getMyTrlOwnerUser } from "../lib/spotify-user";
import { MYTRL_OWNER_HANDLE } from "../lib/mytrl-access";
import { runWithSpotifyBackfillPool } from "../lib/spotify-user-charts-pool";

const DRY_RUN = process.argv.includes("--dry-run");
const DATE_ARG = process.argv.find((a) => a.startsWith("--date="));

function todayBrtKey(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

async function main() {
  const dateKey = DATE_ARG ? DATE_ARG.split("=").slice(1).join("=") : todayBrtKey();
  const ref = parseMyTrlReferenceDate(dateKey);
  if (!ref) {
    throw new Error(`Data inválida ou fim de semana: ${dateKey}`);
  }

  const owner = await getMyTrlOwnerUser();
  if (!owner) throw new Error(`Usuário @${MYTRL_OWNER_HANDLE} não encontrado.`);
  if (!owner.spotifyRefreshToken) throw new Error("Conecte o Spotify do @bruno antes de rodar.");
  if (!owner.spotifyNewHitsPlaylistId) {
    throw new Error(
      "Nenhuma playlist gravada no perfil @bruno. Rode run-mytrl-month.ts --persist-playlist antes.",
    );
  }

  console.log("=== MyTRL diária (@bruno) ===");
  console.log(`Data: ${dateKey}`);
  console.log(`Playlist: ${owner.spotifyNewHitsPlaylistId}`);
  if (DRY_RUN) console.log("Modo: dry-run");

  if (DRY_RUN) {
    console.log("[dry-run] Rodaria runDailyMyTrlJob para esta data.");
    return;
  }

  // Pool "backfill" (app BACKUP3) — mesma isolação do cron, mesmo rodando manualmente.
  const result = await runWithSpotifyBackfillPool(() =>
    runDailyMyTrlJob(ref, { playlistId: owner.spotifyNewHitsPlaylistId }),
  );

  if (!result.ok) {
    console.error(`FALHOU — ${result.error} (stage: ${result.stage ?? "?"})`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `OK — top ${result.publish.count} publicado (${result.publish.created ? "nova parada" : "atualizada"}) — chart ${result.publish.chartId}`,
  );
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
