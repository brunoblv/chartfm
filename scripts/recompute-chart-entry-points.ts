/**
 * Recalcula pontos de todas as ChartEntry conforme parada (principal/secundária),
 * tamanho real da parada e cadência.
 *
 * Uso:
 *   npx tsx scripts/recompute-chart-entry-points.ts
 *   npx tsx scripts/recompute-chart-entry-points.ts --handle=s
 *   npx tsx scripts/recompute-chart-entry-points.ts --handle=s --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

const prisma = new PrismaClient();

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const handleArg = process.argv.find((a) => a.startsWith("--handle="));
  return {
    dryRun,
    handle: handleArg?.split("=")[1]?.trim() || null,
  };
}

async function main() {
  const { dryRun, handle } = parseArgs();

  const charts = await prisma.chart.findMany({
    where: handle ? { user: { handle } } : undefined,
    orderBy: [{ user: { handle: "asc" } }, { weekIndex: "asc" }],
    select: {
      id: true,
      weekIndex: true,
      maxItems: true,
      user: { select: { handle: true } },
      parada: { select: { name: true, isPrimary: true, cadence: true } },
      entries: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, points: true },
      },
    },
  });

  if (charts.length === 0) {
    console.log(handle ? `Nenhuma parada encontrada para @${handle}.` : "Nenhuma parada encontrada.");
    return;
  }

  let updates = 0;
  let mismatches = 0;
  let maxItemsPatches = 0;
  const pendingUpdates: { id: string; points: number }[] = [];

  async function flushUpdates() {
    if (dryRun || pendingUpdates.length === 0) return;
    const chunkSize = 500;
    for (let i = 0; i < pendingUpdates.length; i += chunkSize) {
      const chunk = pendingUpdates.slice(i, i + chunkSize);
      await prisma.$transaction(
        chunk.map((row) =>
          prisma.chartEntry.update({
            where: { id: row.id },
            data: { points: row.points },
          }),
        ),
      );
    }
    pendingUpdates.length = 0;
  }

  for (const chart of charts) {
    const chartSize = chart.entries.length;
    const tier = scoringTierFromPrimary(chart.parada.isPrimary);
    const needsMaxItemsPatch = chart.maxItems !== chartSize;

    if (needsMaxItemsPatch && !dryRun) {
      await prisma.chart.update({
        where: { id: chart.id },
        data: { maxItems: chartSize },
      });
      maxItemsPatches++;
    } else if (needsMaxItemsPatch) {
      maxItemsPatches++;
    }

    for (const entry of chart.entries) {
      const expected = pointsForChartPosition(
        entry.position,
        tier,
        chartSize,
        chart.parada.cadence,
      );
      if (entry.points === expected) continue;
      mismatches++;
      if (entry.position <= 3 && tier === "primary" && entry.points !== expected) {
        console.log(
          `  @${chart.user.handle} · ${chart.parada.name} · semana ${chart.weekIndex} · #${entry.position}: ${entry.points} → ${expected}`,
        );
      }
      pendingUpdates.push({ id: entry.id, points: expected });
      updates++;
    }
  }

  await flushUpdates();

  console.log(
    dryRun
      ? `[dry-run] ${mismatches} entrada(s) desatualizadas em ${charts.length} parada(s); ${maxItemsPatches} chart(s) com maxItems incorreto.`
      : `Atualizadas ${updates} entrada(s) em ${charts.length} parada(s); maxItems corrigido em ${maxItemsPatches} chart(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
