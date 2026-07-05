/**
 * Preenche snapshots congelados das paradas por gênero para semanas que já têm Global 100.
 *
 *   npx tsx scripts/backfill-global-genre-snapshots.ts
 *   npx tsx scripts/backfill-global-genre-snapshots.ts --week=202627
 */
import { prisma } from "../lib/prisma";
import { GLOBAL_GENRE_CHARTS } from "../lib/global-genre-charts";
import { saveGlobalGenreSnapshotForWeek } from "../lib/global-genre-snapshot";

async function main() {
  const weekArg = process.argv.find((a) => a.startsWith("--week="))?.split("=")[1];
  const weekFilter = weekArg ? Number(weekArg) : null;

  const globalWeeks = await prisma.globalSnapshot.findMany({
    where: weekFilter ? { weekIndex: weekFilter } : undefined,
    select: { weekIndex: true },
    orderBy: { weekIndex: "asc" },
  });

  if (!globalWeeks.length) {
    console.log("Nenhuma semana com Global 100 encontrada.");
    return;
  }

  for (const { weekIndex } of globalWeeks) {
    for (const chart of GLOBAL_GENRE_CHARTS) {
      const existing = await prisma.globalGenreSnapshot.findUnique({
        where: { weekIndex_genreSlug: { weekIndex, genreSlug: chart.slug } },
      });
      if (existing) {
        console.log(`  skip ${chart.slug} @ ${weekIndex}`);
        continue;
      }
      await saveGlobalGenreSnapshotForWeek(weekIndex, chart.slug);
      console.log(`  ok   ${chart.slug} @ ${weekIndex}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
