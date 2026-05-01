/**
 * Uso: npx tsx scripts/delete-chart-entries-from-position.ts <chartId> [minPosition]
 * Remove entradas com position >= minPosition (default 101).
 */
import { prisma } from "../lib/prisma";

const chartId = process.argv[2];
const minPos = Number(process.argv[3] ?? "101");

async function main() {
  if (!chartId) {
    console.error("Uso: npx tsx scripts/delete-chart-entries-from-position.ts <chartId> [minPosition]");
    process.exit(1);
  }
  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, weekLabel: true, dateRange: true },
  });
  if (!chart) {
    console.error("Parada não encontrada:", chartId);
    process.exit(1);
  }
  const before = await prisma.chartEntry.count({ where: { chartId } });
  const del = await prisma.chartEntry.deleteMany({
    where: { chartId, position: { gte: minPos } },
  });
  const after = await prisma.chartEntry.count({ where: { chartId } });
  console.log(JSON.stringify({ chart, entriesBefore: before, deleted: del.count, entriesAfter: after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
