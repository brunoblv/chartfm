import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearAllMyTrlData } from "@/lib/mytrl-clear";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { getMyTrlOwnerUser } from "@/lib/spotify-user";
import { MYTRL_WEEKDAYS, type MyTrlChartEntry, buildMyTrlScoringWindow, brtDateKey, formatMyTrlEditionDisplay, myTrlTopEntries } from "@/lib/mytrl-chart-engine";
import { collectSpotifyIds, resolveMyTrlVideoClips } from "@/lib/mytrl-video-clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mytrl?weekday=1&weekIndex=202624
export async function GET(req: NextRequest) {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const weekdayParam = Number(req.nextUrl.searchParams.get("weekday") ?? "1");
  const weekday = MYTRL_WEEKDAYS.some((d) => d.value === weekdayParam) ? weekdayParam : 1;
  const weekIndexParam = req.nextUrl.searchParams.get("weekIndex");

  let snapshot;
  if (weekIndexParam) {
    snapshot = await prisma.myTrlSnapshot.findUnique({
      where: { weekday_weekIndex: { weekday, weekIndex: Number(weekIndexParam) } },
    });
  } else {
    snapshot = await prisma.myTrlSnapshot.findFirst({
      where: { weekday },
      orderBy: { weekIndex: "desc" },
    });
  }

  const history = await prisma.myTrlSnapshot.findMany({
    where: { weekday },
    orderBy: { weekIndex: "desc" },
    select: { weekIndex: true, weekLabel: true, dateRange: true, computedAt: true },
    take: 12,
  });

  if (!snapshot) {
    return NextResponse.json({
      weekday,
      weekdayLabel: MYTRL_WEEKDAYS.find((d) => d.value === weekday)?.label ?? "",
      snapshot: null,
      history,
      videoClips: {},
    });
  }

  const entries = myTrlTopEntries(snapshot.entries as unknown as MyTrlChartEntry[]);
  const owner = await getMyTrlOwnerUser();
  const videoClips = owner
    ? await resolveMyTrlVideoClips(owner.id, collectSpotifyIds(entries))
    : {};
  const scoringWindow = buildMyTrlScoringWindow(brtDateKey(snapshot.computedAt));
  const edition = formatMyTrlEditionDisplay(snapshot.computedAt);

  return NextResponse.json({
    weekday,
    weekdayLabel: MYTRL_WEEKDAYS.find((d) => d.value === weekday)?.label ?? "",
    snapshot: {
      weekIndex: snapshot.weekIndex,
      weekLabel: snapshot.weekLabel,
      dateRange: edition.fullLabel,
      edition,
      scoringWindow,
      computedAt: snapshot.computedAt.toISOString(),
      entries,
    },
    history,
    videoClips,
  });
}

// DELETE /api/mytrl — apaga todas as paradas MyTRL (somente @bruno)
export async function DELETE() {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { snapshots, weeklyCharts } = await clearAllMyTrlData();
    return NextResponse.json({ ok: true, snapshots, weeklyCharts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
