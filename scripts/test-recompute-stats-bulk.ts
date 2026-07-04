/**
 * Testa recomputePersistedChartEntryStatsForParada (versão SQL em massa)
 * comparando o resultado com o cálculo em memória (applyComputedEntryStatsToCharts),
 * sem depender do estado anterior do banco.
 */
import { PrismaClient } from "@prisma/client";
import {
  applyComputedEntryStatsToCharts,
  recomputePersistedChartEntryStatsForParada,
} from "../lib/chart-entry-stats";

const prisma = new PrismaClient();

async function main() {
  const parada = await prisma.parada.findFirst({
    where: { name: { equals: "UCC - United Community Chart", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!parada) throw new Error("Parada UCC não encontrada localmente.");
  console.log(`[info] Parada: ${parada.name} (${parada.id})`);

  const result = await recomputePersistedChartEntryStatsForParada(prisma, parada.id);
  console.log(`[ok] recompute: ${result.charts} charts, ${result.entries} entries`);

  // Busca o que ficou persistido após o recompute
  const persistedCharts = await prisma.chart.findMany({
    where: { paradaId: parada.id },
    orderBy: { weekIndex: "asc" },
    select: {
      id: true,
      weekIndex: true,
      entries: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          songId: true,
          position: true,
          status: true,
          delta: true,
          prevPos: true,
          peak: true,
          weeks: true,
        },
      },
    },
  });
  const persistedById = new Map(
    persistedCharts.flatMap((c) => c.entries).map((e) => [e.id, e]),
  );

  // Recalcula em memória, do zero, só com songId/position (a "fonte da verdade")
  const bareCharts = persistedCharts.map((c) => ({
    weekIndex: c.weekIndex,
    entries: c.entries.map((e) => ({ id: e.id, songId: e.songId, position: e.position })),
  }));
  const expected = applyComputedEntryStatsToCharts(bareCharts);

  let mismatches = 0;
  let total = 0;
  for (const chart of expected) {
    for (const entry of chart.entries) {
      total++;
      const persisted = persistedById.get(entry.id)!;
      if (
        persisted.status !== entry.status ||
        persisted.delta !== entry.delta ||
        persisted.prevPos !== entry.prevPos ||
        persisted.peak !== entry.peak ||
        persisted.weeks !== entry.weeks
      ) {
        mismatches++;
        if (mismatches <= 5) {
          console.log(`[mismatch] entry ${entry.id}`, { persisted, expected: entry });
        }
      }
    }
  }
  console.log(`[info] Mismatches: ${mismatches} / ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
