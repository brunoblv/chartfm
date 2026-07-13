/**
 * Recalcula o snapshot da Parada de Álbuns de UMA ÚNICA semana, a partir de uma data
 * qualquer dentro dela — bem mais rápido que rodar o backfill completo semana a semana.
 *
 * Uso:
 *   npx tsx scripts/rebuild-album-snapshot-date.ts 2026-01-15
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildWeekIndexFromDate, buildWeekLabelFromDate } from "../lib/chart-week";
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

const dateArg = process.argv[2];
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Uso: npx tsx scripts/rebuild-album-snapshot-date.ts YYYY-MM-DD");
  process.exit(1);
}

const [year, month, day] = dateArg.split("-").map(Number);
const date = new Date(year, month - 1, day, 12); // meio-dia evita bordas de fuso

const prisma = new PrismaClient();

async function main() {
  const weekIndex = buildWeekIndexFromDate(date);
  const weekLabel = buildWeekLabelFromDate(date);
  console.log(`Data ${dateArg} → weekIndex ${weekIndex} (${weekLabel})`);

  const started = Date.now();
  const result = await saveGlobalLastfmSnapshotForWeek("albums", weekIndex);
  const count = (result.payload.entries as unknown[]).length;
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`Semana ${weekIndex} recalculada em ${elapsed}s → ${count} álbum(ns).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
