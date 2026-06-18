import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { getMyTrlOwnerUser } from "@/lib/spotify-user";
import { MYTRL_WEEKDAYS, type MyTrlChartEntry, buildMyTrlScoringWindow, brtDateKey, myTrlTopEntries } from "@/lib/mytrl-chart-engine";
import { collectSpotifyIds, resolveMyTrlVideoClips } from "@/lib/mytrl-video-clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mytrl/week?weekIndex=202624
export async function GET(req: NextRequest) {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const owner = await getMyTrlOwnerUser();
  if (!owner) {
    return NextResponse.json({ error: "Dono MyTRL não encontrado" }, { status: 404 });
  }

  const weekIndexParam = req.nextUrl.searchParams.get("weekIndex");

  let weekIndex: number;
  if (weekIndexParam) {
    weekIndex = Number(weekIndexParam);
    if (!Number.isFinite(weekIndex)) {
      return NextResponse.json({ error: "weekIndex inválido" }, { status: 400 });
    }
  } else {
    const latest = await prisma.myTrlSnapshot.findFirst({
      orderBy: { weekIndex: "desc" },
      select: { weekIndex: true },
    });
    if (!latest) {
      return NextResponse.json({
        weekIndex: null,
        weekLabel: null,
        availableWeeks: [],
        days: MYTRL_WEEKDAYS.map((d) => ({
          weekday: d.value,
          weekdayLabel: d.label,
          dateRange: null,
          computedAt: null,
          entries: [] as MyTrlChartEntry[],
        })),
        videoClips: {},
      });
    }
    weekIndex = latest.weekIndex;
  }

  const snapshots = await prisma.myTrlSnapshot.findMany({
    where: { weekIndex },
    orderBy: { weekday: "asc" },
  });

  const snapshotByWeekday = new Map(snapshots.map((s) => [s.weekday, s]));
  const weekLabel = snapshots[0]?.weekLabel ?? `Semana ${weekIndex}`;

  const days = MYTRL_WEEKDAYS.map((d) => {
    const snap = snapshotByWeekday.get(d.value);
    return {
      weekday: d.value,
      weekdayLabel: d.label,
      dateRange: snap?.dateRange ?? null,
      scoringWindow: snap ? buildMyTrlScoringWindow(brtDateKey(snap.computedAt)) : null,
      computedAt: snap?.computedAt.toISOString() ?? null,
      entries: myTrlTopEntries((snap?.entries as unknown as MyTrlChartEntry[]) ?? []),
    };
  });

  const allEntries = days.flatMap((d) => d.entries);
  const videoClips = await resolveMyTrlVideoClips(owner.id, collectSpotifyIds(allEntries));

  const weekGroups = await prisma.myTrlSnapshot.groupBy({
    by: ["weekIndex"],
    _max: { computedAt: true },
    orderBy: { weekIndex: "desc" },
    take: 24,
  });

  const weekIndexes = weekGroups.map((g) => g.weekIndex);
  const metaRows = weekIndexes.length
    ? await prisma.myTrlSnapshot.findMany({
        where: { weekIndex: { in: weekIndexes }, weekday: 1 },
        select: { weekIndex: true, weekLabel: true, dateRange: true },
      })
    : [];

  const metaByWeek = new Map(metaRows.map((r) => [r.weekIndex, r]));
  const availableWeeks = weekIndexes.map((wi) => {
    const meta = metaByWeek.get(wi);
    return {
      weekIndex: wi,
      weekLabel: meta?.weekLabel ?? `Semana ${wi}`,
      dateRange: meta?.dateRange ?? null,
    };
  });

  return NextResponse.json({
    weekIndex,
    weekLabel,
    availableWeeks,
    days,
    videoClips,
  });
}
