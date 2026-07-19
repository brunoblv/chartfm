import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";
import { generateRetroHistory, TARGET_PARADA } from "@/lib/retro/generate-history";
import type { RetroTarget } from "@/lib/retro/build-pool";

const MIN_YEAR = 1990;

function parseTarget(raw: string | null): RetroTarget | null {
  return raw === "hot100" || raw === "clipes" ? raw : null;
}

/** Semana sobrepõe o mês civil (UTC)? */
function weekOverlapsMonth(weekStart: Date, year: number, month: number): boolean {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0, 23, 59, 59, 999);
  const weekEnd = weekStart.getTime() + 6 * 86_400_000;
  return weekStart.getTime() <= monthEnd && weekEnd >= monthStart;
}

/**
 * GET /api/retro/weekly-preview?year=2005&month=5&target=hot100&startYear=2004&startMonth=5&weekIndex=200522
 *
 * Simula o Hot 100 (estreia + carry-over) até o mês pedido e devolve as semanas
 * desse mês + o chart completo de uma delas — preview sem gravar nada.
 * Default de início: um ano antes do mês pedido (aquece o chart com ~100 faixas).
 */
export async function GET(req: NextRequest) {
  const userId = await requireBruno();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const target = parseTarget(sp.get("target"));
  const weekIndexParam = sp.get("weekIndex");
  const nowYear = new Date().getUTCFullYear();

  if (!target) return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  if (!Number.isInteger(year) || year < MIN_YEAR || year > nowYear) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const defaultStartYear = Math.max(MIN_YEAR, year - 1);
  const startYear = sp.get("startYear") != null ? Number(sp.get("startYear")) : defaultStartYear;
  const startMonth = sp.get("startMonth") != null ? Number(sp.get("startMonth")) : month;
  if (!Number.isInteger(startYear) || startYear < MIN_YEAR || startYear > year) {
    return NextResponse.json({ error: "invalid_start_year" }, { status: 400 });
  }
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    return NextResponse.json({ error: "invalid_start_month" }, { status: 400 });
  }
  if (startYear > year || (startYear === year && startMonth > month)) {
    return NextResponse.json({ error: "start_after_through" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastfmUser: true } });
  if (!user?.lastfmUser) {
    return NextResponse.json({ error: "no_lastfm_user" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof generateRetroHistory>>;
  try {
    result = await generateRetroHistory({
      userId,
      lastfmUser: user.lastfmUser,
      target,
      startYear,
      startMonth,
      throughYear: year,
      throughMonth: month,
      previewOnly: true,
    });
  } catch (err) {
    console.error("[/api/retro/weekly-preview] falha:", err);
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const monthWeeks = result.weeks.filter((w) => weekOverlapsMonth(w.weekStartDate, year, month));
  if (monthWeeks.length === 0) {
    return NextResponse.json({
      period: { year, month, target, startYear, startMonth },
      chartSize: result.chartSize,
      totalDebuts: result.debuts.length,
      debutsInMonth: result.debuts.filter((d) => {
        const dt = new Date(`${d.debutDate}T00:00:00Z`);
        return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month;
      }).length,
      weeks: [],
      chart: null,
    });
  }

  const requested =
    weekIndexParam != null && Number.isFinite(Number(weekIndexParam))
      ? monthWeeks.find((w) => w.weekIndex === Number(weekIndexParam))
      : null;
  const selected = requested ?? monthWeeks[monthWeeks.length - 1]!;

  const debutById = new Map(result.debuts.map((d) => [d.songId, d]));
  const songIds = selected.entries.map((e) => e.songId);
  const songs = await prisma.song.findMany({
    where: { id: { in: songIds } },
    select: {
      id: true,
      title: true,
      artist: true,
      albumRef: { select: { coverUrl: true } },
    },
  });
  const songById = new Map(songs.map((s) => [s.id, s]));

  return NextResponse.json({
    period: { year, month, target, startYear, startMonth },
    chartSize: result.chartSize ?? TARGET_PARADA[target].chartSize,
    totalDebuts: result.debuts.length,
    debutsInMonth: result.debuts.filter((d) => {
      const dt = new Date(`${d.debutDate}T00:00:00Z`);
      return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month;
    }).length,
    monthsScanned: result.monthsScanned,
    weeks: monthWeeks.map((w) => ({
      weekIndex: w.weekIndex,
      weekLabel: w.weekLabel,
      dateRange: w.dateRange,
      weekStartDate: w.weekStartDate.toISOString().slice(0, 10),
    })),
    chart: {
      weekIndex: selected.weekIndex,
      weekLabel: selected.weekLabel,
      dateRange: selected.dateRange,
      weekStartDate: selected.weekStartDate.toISOString().slice(0, 10),
      entries: selected.entries.map((e) => {
        const song = songById.get(e.songId);
        const debut = debutById.get(e.songId);
        return {
          position: e.position,
          songId: e.songId,
          title: song?.title ?? debut?.title ?? "—",
          artist: song?.artist ?? debut?.artist ?? "—",
          coverUrl: song?.albumRef?.coverUrl ?? null,
          status: e.status,
          delta: e.delta,
          prevPos: e.prevPos,
          peak: e.peak,
          weeks: e.weeks,
          power: Math.round(e.power * 10) / 10,
          scoreFinal: debut?.scoreFinal ?? null,
          debutDate: debut?.debutDate ?? null,
        };
      }),
    },
  });
}
