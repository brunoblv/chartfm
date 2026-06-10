/**
 * Recalcula semanas específicas sem o filtro de prazo (terça 00h BRT),
 * incluindo todas as paradas independente de quando foram publicadas.
 *
 * Uso: npx tsx scripts/fix-weeks-no-deadline.ts
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

import { saveGlobalSnapshotForWeek } from "../lib/global-snapshot";
import { prisma } from "../lib/prisma";

const WEEKS_TO_FIX = [202614, 202615];

async function main() {
  for (const weekIndex of WEEKS_TO_FIX) {
    const before = await prisma.globalSnapshot.findUnique({
      where: { weekIndex },
      select: { weeklySongs: true },
    });
    const beforeCount = Array.isArray(before?.weeklySongs) ? (before!.weeklySongs as unknown[]).length : 0;
    console.log(`Semana ${weekIndex}: antes ${beforeCount} músicas — recalculando sem filtro de prazo…`);

    const result = await saveGlobalSnapshotForWeek(weekIndex, { skipDeadline: true });
    const afterCount = result.payload.weeklySongs.length;
    console.log(`Semana ${weekIndex}: após  ${afterCount} músicas ✓`);
  }
  console.log("\nConcluído.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
