import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { MYTRL_WEEKDAYS, formatMyTrlEditionDisplay } from "@/lib/mytrl-chart-engine";
import { myTrlDayIndexFromDate } from "@/lib/mytrl-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mytrl/timeline — todas as edições em ordem cronológica (seg–sex)
export async function GET() {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const rows = await prisma.myTrlSnapshot.findMany({
    select: {
      weekday: true,
      weekIndex: true,
      weekLabel: true,
      dateRange: true,
      computedAt: true,
    },
  });

  const editions = rows
    .map((row) => {
      const edition = formatMyTrlEditionDisplay(row.computedAt);
      return {
        weekday: row.weekday,
        weekIndex: row.weekIndex,
        weekdayLabel: edition.weekdayLabel || (MYTRL_WEEKDAYS.find((d) => d.value === row.weekday)?.label ?? ""),
        weekLabel: row.weekLabel,
        dateRange: edition.fullLabel,
        edition,
        computedAt: row.computedAt.toISOString(),
        dayIndex: myTrlDayIndexFromDate(row.computedAt),
      };
    })
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map(({ dayIndex: _dayIndex, ...edition }) => edition);

  return NextResponse.json({ editions });
}
