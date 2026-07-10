import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { MYTRL_WEEKLY_PARADA_ID, isMyTrlOwner } from "@/lib/mytrl-access";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";

export const runtime = "nodejs";

type DailyCell = { position: number | null; score: number };

/** Detalhamento diário (seg-sex) do top 20 semanal MyTRL — só visível para @bruno. */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isMyTrlOwner(session?.user?.handle)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, paradaId: true, weekIndex: true },
  });
  if (!chart || chart.paradaId !== MYTRL_WEEKLY_PARADA_ID) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const snapshots = await prisma.myTrlSnapshot.findMany({
    where: { weekIndex: chart.weekIndex, weekday: { in: [1, 2, 3, 4, 5] } },
    orderBy: { weekday: "asc" },
  });

  const bySongSpotifyId: Record<string, Record<number, DailyCell>> = {};
  for (const snap of snapshots) {
    const entries = snap.entries as unknown as MyTrlChartEntry[];
    for (const entry of entries) {
      if (!entry.spotifyId || entry.score <= 0) continue;
      if (!bySongSpotifyId[entry.spotifyId]) bySongSpotifyId[entry.spotifyId] = {};
      bySongSpotifyId[entry.spotifyId][snap.weekday] = {
        position: entry.position,
        score: entry.score,
      };
    }
  }

  return NextResponse.json({
    weekdays: [1, 2, 3, 4, 5],
    bySongSpotifyId,
  });
}
