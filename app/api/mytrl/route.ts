import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { getMyTrlOwnerUser } from "@/lib/spotify-user";
import { MYTRL_WEEKDAYS, type MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
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

  const entries = snapshot.entries as unknown as MyTrlChartEntry[];
  const owner = await getMyTrlOwnerUser();
  const videoClips = owner
    ? await resolveMyTrlVideoClips(owner.id, collectSpotifyIds(entries))
    : {};

  return NextResponse.json({
    weekday,
    weekdayLabel: MYTRL_WEEKDAYS.find((d) => d.value === weekday)?.label ?? "",
    snapshot: {
      weekIndex: snapshot.weekIndex,
      weekLabel: snapshot.weekLabel,
      dateRange: snapshot.dateRange,
      computedAt: snapshot.computedAt.toISOString(),
      entries,
    },
    history,
    videoClips,
  });
}
