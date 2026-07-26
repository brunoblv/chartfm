/**
 * Força as 22 paradas autoDecay para Top 20:
 * - Parada.chartSize = 20
 * - Chart.maxItems = 20 em todas as edições
 * - Remove ChartEntry com position > 20
 * - Limpa flashback/destaque se a música saiu do top 20
 *
 * Usage:
 *   npx tsx scripts/truncate-genre-paradas-to-top20.ts
 *   npx tsx scripts/truncate-genre-paradas-to-top20.ts --prod
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

const DRY_RUN = !process.argv.includes("--prod");
process.env.DATABASE_URL =
  process.env.PROD_DATABASE_URL ?? process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;

const TOP = 20;
const prisma = new PrismaClient();

async function main() {
  console.log(DRY_RUN ? "=== DRY-RUN (nada será gravado). Use --prod para gravar. ===\n" : "=== PRODUÇÃO ===\n");

  const paradas = await prisma.parada.findMany({
    where: { autoDecay: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      chartSize: true,
      user: { select: { handle: true } },
      charts: {
        select: {
          id: true,
          weekIndex: true,
          maxItems: true,
          flashbackSongId: true,
          destaqueSongId: true,
          _count: { select: { entries: true } },
          entries: {
            where: { position: { gt: TOP } },
            select: { id: true, position: true, songId: true },
          },
        },
      },
    },
  });

  console.log(`Paradas autoDecay: ${paradas.length}\n`);

  let paradasUpdated = 0;
  let chartsUpdated = 0;
  let entriesDeleted = 0;
  let spotlightsCleared = 0;

  for (const p of paradas) {
    const excess = p.charts.reduce((n, c) => n + c.entries.length, 0);
    const needsSize = p.chartSize !== TOP;
    const chartsNeedingMax = p.charts.filter((c) => c.maxItems !== TOP).length;
    console.log(
      `@${p.user.handle} "${p.name}" chartSize=${p.chartSize ?? "null"} → ${TOP} | charts=${p.charts.length} | excessEntries=${excess} | maxItems≠20: ${chartsNeedingMax}`,
    );

    if (DRY_RUN) continue;

    if (needsSize) {
      await prisma.parada.update({ where: { id: p.id }, data: { chartSize: TOP } });
      paradasUpdated++;
    }

    for (const c of p.charts) {
      const excessSongIds = new Set(c.entries.map((e) => e.songId));
      const clearFlashback = c.flashbackSongId != null && excessSongIds.has(c.flashbackSongId);
      const clearDestaque = c.destaqueSongId != null && excessSongIds.has(c.destaqueSongId);

      if (c.entries.length) {
        const del = await prisma.chartEntry.deleteMany({
          where: { chartId: c.id, position: { gt: TOP } },
        });
        entriesDeleted += del.count;
      }

      const patch: { maxItems?: number; flashbackSongId?: null; destaqueSongId?: null } = {};
      if (c.maxItems !== TOP) patch.maxItems = TOP;
      if (clearFlashback) {
        patch.flashbackSongId = null;
        spotlightsCleared++;
      }
      if (clearDestaque) {
        patch.destaqueSongId = null;
        spotlightsCleared++;
      }
      if (Object.keys(patch).length) {
        await prisma.chart.update({ where: { id: c.id }, data: patch });
        chartsUpdated++;
      }
    }
  }

  if (DRY_RUN) {
    console.log("\nDry-run ok. Rode com --prod para aplicar.");
  } else {
    console.log(
      `\nFeito: paradas=${paradasUpdated}, charts=${chartsUpdated}, entries removidas=${entriesDeleted}, spotlights limpos=${spotlightsCleared}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
