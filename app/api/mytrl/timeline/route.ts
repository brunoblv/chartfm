import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { MYTRL_WEEKDAYS } from "@/lib/mytrl-chart-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mytrl/timeline — todas as edições em ordem cronológica (seg–sex)
export async function GET() {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const rows = await prisma.myTrlSnapshot.findMany({
    orderBy: [{ weekIndex: "asc" }, { weekday: "asc" }],
    select: {
      weekday: true,
      weekIndex: true,
      weekLabel: true,
      dateRange: true,
      computedAt: true,
    },
  });

  const editions = rows.map((row) => ({
    weekday: row.weekday,
    weekIndex: row.weekIndex,
    weekdayLabel: MYTRL_WEEKDAYS.find((d) => d.value === row.weekday)?.label ?? "",
    weekLabel: row.weekLabel,
    dateRange: row.dateRange,
    computedAt: row.computedAt.toISOString(),
  }));

  return NextResponse.json({ editions });
}
