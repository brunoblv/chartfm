import { buildAndSaveDailyChartSongStats } from "@/lib/daily-chart-song-stats";
import { refreshAllEntityPageSnapshots } from "@/lib/entity-page-snapshot/refresh";
import { syncChartEntryPointsForRankingWeek } from "@/lib/sync-chart-entry-points";

/** 0h — pontos das paradas + agregado global do app + snapshots de páginas (stats globais). */
export async function refreshDailyAppStats(now: Date = new Date()) {
  const points = await syncChartEntryPointsForRankingWeek(now);
  await buildAndSaveDailyChartSongStats(now);
  const entities = await refreshAllEntityPageSnapshots({ skipDailyStatsBuild: true });

  return { points, entities };
}
