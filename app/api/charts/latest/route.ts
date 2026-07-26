import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { buildPeriodFromDate, prevPeriodIndex } from "@/lib/chart-cadence";
import { parseChartWeekPickerDate } from "@/lib/chart-week";
import { prisma } from "@/lib/prisma";
import { resolveParadaForPublish } from "@/lib/paradas";

export const runtime = "nodejs";

/**
 * GET /api/charts/latest?weekDate=AAAA-MM-DD
 * Parada publicada no período anterior (dia ou semana) à data informada.
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

  const paradaIdParam = req.nextUrl.searchParams.get("paradaId");
  const parada = await resolveParadaForPublish(prisma, session.user.id, paradaIdParam);

  const currentPeriod = buildPeriodFromDate(anchor, parada.cadence);
  const previousPeriodIndex = prevPeriodIndex(currentPeriod.periodIndex, parada.cadence);

  const previousDate = new Date(anchor);
  previousDate.setDate(previousDate.getDate() - (parada.cadence === "DAILY" ? 1 : 7));
  const previousPeriod = buildPeriodFromDate(previousDate, parada.cadence);
  const legacyPreviousWeekOnly = previousPeriodIndex % 100;

  // Diário: última parada antes da data (ex. segunda → sexta), não o dia civil anterior.
  let chart =
    parada.cadence === "DAILY"
      ? await prisma.chart.findFirst({
          where: { paradaId: parada.id, weekIndex: { lt: currentPeriod.periodIndex } },
          orderBy: { weekIndex: "desc" },
          include: {
            entries: {
              orderBy: { position: "asc" },
              include: { song: true },
            },
          },
        })
      : await prisma.chart.findUnique({
          where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex: previousPeriodIndex } },
          include: {
            entries: {
              orderBy: { position: "asc" },
              include: { song: true },
            },
          },
        });

  if (!chart && parada.cadence === "WEEKLY") {
    chart = await prisma.chart.findFirst({
      where: {
        userId: session.user.id,
        paradaId: parada.id,
        OR: [
          { weekIndex: legacyPreviousWeekOnly },
          { weekLabel: previousPeriod.periodLabel },
          { dateRange: previousPeriod.dateRange },
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
    return NextResponse.json(
      {
        error:
          parada.cadence === "DAILY" ? "no_chart_for_previous_day" : "no_chart_for_previous_week",
      },
      { status: 404 },
    );
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
