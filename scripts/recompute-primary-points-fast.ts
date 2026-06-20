/**
 * Recalcula pontos de paradas principais via SQL (rápido).
 * Paradas secundárias são recalculadas em JS (menos entradas).
 */
import { PrismaClient } from "@prisma/client";
import { calcularPontosPrimary } from "../lib/parada-points";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

const prisma = new PrismaClient();

async function main() {
  const lookup = Array.from({ length: 100 }, (_, i) => calcularPontosPrimary(i + 1));
  const caseSql = lookup
    .map((pts, i) => `WHEN ce."position" = ${i + 1} THEN ${pts}`)
    .join("\n          ");

  const primaryUpdated = await prisma.$executeRawUnsafe(`
    UPDATE "ChartEntry" ce
    SET "points" = CASE
          ${caseSql}
          ELSE ce."points"
        END
    FROM "Chart" c
    INNER JOIN "paradas" p ON p."id" = c."parada_id"
    WHERE ce."chartId" = c."id"
      AND p."is_primary" = true
  `);

  const secondaryCharts = await prisma.chart.findMany({
    where: { parada: { isPrimary: false } },
    select: {
      id: true,
      entries: { select: { id: true, position: true, points: true } },
      parada: { select: { isPrimary: true, cadence: true } },
    },
  });

  let secondaryUpdated = 0;
  for (const chart of secondaryCharts) {
    const chartSize = chart.entries.length;
    const tier = scoringTierFromPrimary(chart.parada.isPrimary);
    for (const entry of chart.entries) {
      const expected = pointsForChartPosition(entry.position, tier, chartSize, chart.parada.cadence);
      if (entry.points === expected) continue;
      await prisma.chartEntry.update({ where: { id: entry.id }, data: { points: expected } });
      secondaryUpdated++;
    }
  }

  console.log(`Paradas principais: ${primaryUpdated} entrada(s) atualizadas.`);
  console.log(`Paradas secundárias: ${secondaryUpdated} entrada(s) atualizadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
