import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { refreshAllGlobalLastfmSnapshots } from "@/lib/global-lastfm-snapshot";
import { sendGlobalWeeklyNotification } from "@/lib/global-weekly-notifications";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
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

  const snapshot = await getOrCreateRankingWeekSnapshot(now);
  const lastfm = await refreshAllGlobalLastfmSnapshots(now);

  let notificationsSent = 0;
  if (snapshot.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_chart",
      "/global/100",
      `A Parada Global (${snapshot.weekLabel}) foi publicada! Confira os resultados.`,
    );
  }

  if (lastfm.airplay.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_airplay",
      "/global/airplay",
      `O Global 100 Air Play (${lastfm.airplay.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
    );
  }

  if (lastfm.albums.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_albums",
      "/global/albums",
      `O Global 100 Álbuns (${lastfm.albums.weekLabel}) foi publicado! Veja os discos mais ouvidos da semana.`,
    );
  }

  return NextResponse.json({
    ok: true,
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    updatedRows,
    snapshotCreated: snapshot.created,
    lastfmAirplayCreated: lastfm.airplay.created,
    lastfmAlbumsCreated: lastfm.albums.created,
    notificationsSent,
  });
}
