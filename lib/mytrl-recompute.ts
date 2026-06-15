import { prisma } from "@/lib/prisma";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { recomputeMyTrlEditionStats } from "@/lib/mytrl-stats";

/** Recalcula estatísticas de todas as edições em ordem cronológica (por data BRT). */
export async function recomputeAllMyTrlSnapshots(): Promise<{ editions: number }> {
  const rows = await prisma.myTrlSnapshot.findMany({
    orderBy: { computedAt: "asc" },
  });

  if (rows.length === 0) return { editions: 0 };

  const computed = recomputeMyTrlEditionStats(
    rows.map((row) => ({
      weekday: row.weekday,
      weekIndex: row.weekIndex,
      computedAt: row.computedAt,
      entries: row.entries as unknown as MyTrlChartEntry[],
    })),
  );

  await Promise.all(
    rows.map((row) => {
      const key = `${row.weekday}:${row.weekIndex}`;
      const entries = computed.get(key);
      if (!entries) return Promise.resolve();
      return prisma.myTrlSnapshot.update({
        where: { weekday_weekIndex: { weekday: row.weekday, weekIndex: row.weekIndex } },
        data: { entries: JSON.parse(JSON.stringify(entries)) },
      });
    }),
  );

  return { editions: rows.length };
}
