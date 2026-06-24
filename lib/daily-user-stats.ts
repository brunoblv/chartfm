import { buildAndSaveDailyChartSongStats, getLatestDailyChartSongStats } from "@/lib/daily-chart-song-stats";
import { refreshAllEntityPageSnapshots } from "@/lib/entity-page-snapshot/refresh";

/** 8h — snapshots de páginas com stats por usuário/parada (usa agregado global da meia-noite). */
export async function refreshDailyUserStats(now: Date = new Date()) {
  const dailyStats =
    (await getLatestDailyChartSongStats()) ?? (await buildAndSaveDailyChartSongStats(now));

  const entities = await refreshAllEntityPageSnapshots({
    skipDailyStatsBuild: true,
    dailyStats,
    now,
  });

  return { entities, snapshotDay: dailyStats.snapshotDay };
}
