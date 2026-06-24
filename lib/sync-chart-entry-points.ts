import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";

/** Sincroniza campo `points` das entradas da semana de ranking atual com a tabela de pontos. */
export async function syncChartEntryPointsForRankingWeek(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);

  const entries = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: rankingWeek.weekIndex } },
    select: {
      id: true,
      position: true,
      points: true,
      chart: {
        select: {
          parada: { select: { isPrimary: true, cadence: true } },
          _count: { select: { entries: true } },
        },
      },
    },
  });

  let updatedRows = 0;
  for (const entry of entries) {
    const chartSize = entry.chart._count.entries;
    const tier = scoringTierFromPrimary(entry.chart.parada.isPrimary);
    const expected = pointsForChartPosition(entry.position, tier, chartSize, entry.chart.parada.cadence);
    if (entry.points === expected) continue;
    await prisma.chartEntry.update({
      where: { id: entry.id },
      data: { points: expected },
    });
    updatedRows++;
  }

  return {
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    updatedRows,
  };
}
