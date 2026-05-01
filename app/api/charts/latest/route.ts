import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  buildDateRangeFromDate,
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  parseChartWeekPickerDate,
  prevChartWeekIndex,
} from "@/lib/chart-week";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/charts/latest?weekDate=AAAA-MM-DD
 * Parada publicada na semana ISO **anterior** à da data informada (mesmo critério do campo Data ao publicar).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const weekDateParam = req.nextUrl.searchParams.get("weekDate")?.trim() ?? "";
  const anchor = parseChartWeekPickerDate(weekDateParam);
  if (!anchor) {
    return NextResponse.json({ error: "Informe weekDate=AAAA-MM-DD (data no campo da parada)." }, { status: 400 });
  }

  const currentWeekIndex = buildWeekIndexFromDate(anchor);
  const previousWeekIndex = prevChartWeekIndex(currentWeekIndex);
  const previousDate = new Date(anchor);
  previousDate.setDate(previousDate.getDate() - 7);
  const previousWeekLabel = buildWeekLabelFromDate(previousDate);
  const previousDateRange = buildDateRangeFromDate(previousDate);
  const legacyPreviousWeekOnly = previousWeekIndex % 100;

  let chart = await prisma.chart.findUnique({
    where: { userId_weekIndex: { userId: session.user.id, weekIndex: previousWeekIndex } },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: { song: true },
      },
    },
  });

  // Compatibilidade com dados legados: algumas paradas antigas podem ter `weekIndex`
  // salvo só com o número da semana (ex.: 17), sem o ano codificado.
  if (!chart) {
    chart = await prisma.chart.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { weekIndex: legacyPreviousWeekOnly },
          { weekLabel: previousWeekLabel },
          { dateRange: previousDateRange },
        ],
      },
      orderBy: { publishedAt: "desc" },
      include: {
        entries: {
          orderBy: { position: "asc" },
          include: { song: true },
        },
      },
    });
  }

  if (!chart) {
    return NextResponse.json({ error: "no_chart_for_previous_week" }, { status: 404 });
  }

  return NextResponse.json({
    id: chart.id,
    weekLabel: chart.weekLabel,
    dateRange: chart.dateRange,
    weekIndex: chart.weekIndex,
    entries: chart.entries.map((e) => ({
      title: e.song.exhibitionName?.trim() || e.song.title,
      artist: e.song.artist,
      album: e.song.album ?? "",
      spotifyId: e.song.spotifyId ?? null,
    })),
  });
}
