/**
 * Apaga snapshots da Parada de Álbuns e recalcula semana a semana.
 *
 * Uso:
 *   npx tsx scripts/rebuild-album-snapshots.ts
 *   npx tsx scripts/rebuild-album-snapshots.ts --dry-run
 *   npx tsx scripts/rebuild-album-snapshots.ts --from=202620
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "../lib/global-ranking-config";
import { listGlobalRankingWeekIndexes } from "../lib/global-snapshot";
import { saveGlobalLastfmSnapshotForWeek } from "../lib/global-lastfm-snapshot";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const dryRun = process.argv.includes("--dry-run");
const fromArg = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
const fromWeek = fromArg ? parseInt(fromArg, 10) : GLOBAL_RANKING_FIRST_WEEK_INDEX;

const prisma = new PrismaClient();

async function main() {
  const allWeeks = await listGlobalRankingWeekIndexes();
  const weeks = allWeeks
    .filter((w) => w >= GLOBAL_RANKING_FIRST_WEEK_INDEX && w >= fromWeek)
    .sort((a, b) => a - b);

  console.log(`Corte inicial:  weekIndex >= ${GLOBAL_RANKING_FIRST_WEEK_INDEX}`);
  if (fromWeek > GLOBAL_RANKING_FIRST_WEEK_INDEX) {
    console.log(`Recalculando a partir de: weekIndex >= ${fromWeek}`);
  }
  console.log(`Semanas a recalcular (${weeks.length}): ${weeks.join(", ") || "(nenhuma)"}`);

  if (dryRun) {
    const count = await prisma.globalAlbumsSnapshot.count({
      where: { weekIndex: { gte: fromWeek } },
    });
    console.log(
      `[dry-run] Apagaria ${count} snapshot(s) de álbuns e recriaria ${weeks.length} semana(s).`,
    );
    return;
  }

  await prisma.globalAlbumsSnapshot.deleteMany({
    where: { weekIndex: { gte: fromWeek } },
  });
  console.log(`Snapshots de álbuns a partir de ${fromWeek} removidos.\n`);

  const started = Date.now();
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekIndex = weeks[i];
    const prefix = `[${i + 1}/${weeks.length}] Semana ${weekIndex}`;
    try {
      const result = await saveGlobalLastfmSnapshotForWeek("albums", weekIndex);
      const count = (result.payload.entries as unknown[]).length;
      console.log(`${prefix} → ${count} álbum(ns)`);
      ok++;
    } catch (err) {
      console.error(`${prefix} ERRO:`, err);
      failed++;
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nConcluído em ${elapsed}s — ${ok} semana(s) OK, ${failed} erro(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
