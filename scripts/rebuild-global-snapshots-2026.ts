/**
 * Apaga todos os snapshots do Global 100 e recalcula apenas semanas de 2026+.
 * Dados anteriores a 202601 não entram no ranking.
 *
 * Uso: npx tsx scripts/rebuild-global-snapshots-2026.ts
 *      npx tsx scripts/rebuild-global-snapshots-2026.ts --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "../lib/global-ranking-config";
import { rebuildAllGlobalSnapshotsFrom2026, listGlobalRankingWeekIndexes } from "../lib/global-snapshot";

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
const prisma = new PrismaClient();

async function main() {
  const weeks = await listGlobalRankingWeekIndexes();
  console.log(`Corte Global 100: weekIndex >= ${GLOBAL_RANKING_FIRST_WEEK_INDEX}`);
  console.log(`Semanas a recalcular (${weeks.length}):`, weeks.join(", ") || "(nenhuma)");

  if (dryRun) {
    const count = await prisma.globalSnapshot.count();
    console.log(`[dry-run] Apagaria ${count} snapshot(s) e recriaria ${weeks.length} semana(s).`);
    return;
  }

  const started = Date.now();
  const result = await rebuildAllGlobalSnapshotsFrom2026({
    onWeek: (weekIndex, index, total) => {
      console.log(`[${index}/${total}] Snapshot semana ${weekIndex}…`);
    },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `Concluído em ${elapsed}s: ${result.deletedCount} snapshot(s) removido(s), ${result.rebuiltWeeks.length} semana(s) recriada(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
