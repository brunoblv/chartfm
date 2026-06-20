/**
 * Popula snapshots Last.fm (Air Play + Álbuns) para as semanas de junho/2026.
 *
 * Uso:
 *   npx tsx scripts/seed-global-lastfm-june-2026.ts
 *   npx tsx scripts/seed-global-lastfm-june-2026.ts --mode=albums
 *   npx tsx scripts/seed-global-lastfm-june-2026.ts --mode=airplay
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildWeekIndexFromDate, getRankingWeekReference } from "../lib/chart-week";
import { saveGlobalLastfmSnapshotForWeek } from "../lib/global-lastfm-snapshot";
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

const YEAR = 2026;
const MONTH = 6;
const modeArg = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1];
const MODES: GlobalLastfmMode[] =
  modeArg === "airplay" || modeArg === "albums" ? [modeArg] : ["airplay", "albums"];

function weekIndexesForMonth(year: number, month: number): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const set = new Set<number>();
  for (let day = 1; day <= daysInMonth; day++) {
    set.add(buildWeekIndexFromDate(new Date(year, month - 1, day)));
  }
  return [...set].sort((a, b) => a - b);
}

const prisma = new PrismaClient();

async function main() {
  const rankingWeek = getRankingWeekReference(new Date());
  const weeks = weekIndexesForMonth(YEAR, MONTH).filter((w) => w <= rankingWeek.weekIndex);
  console.log(`Semanas de junho/${YEAR} (até ${rankingWeek.weekIndex}): ${weeks.join(", ") || "(nenhuma)"}`);
  console.log(`Modos: ${MODES.join(", ")}`);

  const started = Date.now();
  for (const mode of MODES) {
    console.log(`\n=== ${mode} ===`);
    for (let i = 0; i < weeks.length; i++) {
      const weekIndex = weeks[i];
      const t0 = Date.now();
      console.log(`[${i + 1}/${weeks.length}] Semana ${weekIndex}…`);
      const result = await saveGlobalLastfmSnapshotForWeek(mode, weekIndex);
      console.log(
        `  → ${result.payload.entries.length} entradas, ${result.payload.contributorCount} ouvintes (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
      );
    }
  }

  const [airplay, albums] = await Promise.all([
    prisma.globalAirplaySnapshot.findMany({ select: { weekIndex: true, contributorCount: true }, orderBy: { weekIndex: "asc" } }),
    prisma.globalAlbumsSnapshot.findMany({ select: { weekIndex: true, contributorCount: true }, orderBy: { weekIndex: "asc" } }),
  ]);
  console.log(`\nConcluído em ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  console.log("Air Play:", airplay.map((r) => r.weekIndex).join(", ") || "(vazio)");
  console.log("Álbuns:", albums.map((r) => r.weekIndex).join(", ") || "(vazio)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
