/**
 * Apaga snapshots do Global Air Play / Global Álbuns e recalcula semanas de 2026+.
 *
 * Nota: semanas antigas dependem do histórico ainda disponível na API Last.fm.
 *
 * Uso:
 *   npx tsx scripts/rebuild-global-lastfm-snapshots.ts
 *   npx tsx scripts/rebuild-global-lastfm-snapshots.ts --dry-run
 *   npx tsx scripts/rebuild-global-lastfm-snapshots.ts --mode airplay
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "../lib/global-ranking-config";
import { listGlobalRankingWeekIndexes } from "../lib/global-snapshot";
import {
  rebuildAllGlobalLastfmSnapshots,
} from "../lib/global-lastfm-snapshot";
import type { GlobalLastfmMode } from "../lib/global-lastfm-ranking";

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
const modeArg = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1];
const modes: GlobalLastfmMode[] =
  modeArg === "airplay" || modeArg === "albums" ? [modeArg] : ["airplay", "albums"];

const prisma = new PrismaClient();

async function main() {
  const weeks = (await listGlobalRankingWeekIndexes()).filter(
    (w) => w >= GLOBAL_RANKING_FIRST_WEEK_INDEX,
  );
  console.log(`Corte: weekIndex >= ${GLOBAL_RANKING_FIRST_WEEK_INDEX}`);
  console.log(`Semanas a recalcular (${weeks.length}):`, weeks.join(", ") || "(nenhuma)");
  console.log(`Modos: ${modes.join(", ")}`);

  if (dryRun) {
    const [airplayCount, albumsCount] = await Promise.all([
      prisma.globalAirplaySnapshot.count(),
      prisma.globalAlbumsSnapshot.count(),
    ]);
    console.log(
      `[dry-run] Apagaria ${airplayCount} airplay + ${albumsCount} álbuns e recriaria ${weeks.length} semana(s) por modo.`,
    );
    return;
  }

  const started = Date.now();
  for (const mode of modes) {
    console.log(`\n=== Rebuild ${mode} ===`);
    const result = await rebuildAllGlobalLastfmSnapshots(mode, {
      onWeek: (weekIndex, index, total) => {
        console.log(`[${mode} ${index}/${total}] Semana ${weekIndex}…`);
      },
    });
    console.log(
      `${mode}: ${result.deletedCount} snapshot(s) removido(s), ${result.rebuiltWeeks.length} semana(s) recriada(s).`,
    );
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nConcluído em ${elapsed}s.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
