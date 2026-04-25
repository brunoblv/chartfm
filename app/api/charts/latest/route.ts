import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const chart = await prisma.chart.findFirst({
    where: { userId: session.user.id },
    orderBy: { weekIndex: "desc" },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: { song: true },
      },
    },
  });

  if (!chart) {
    return NextResponse.json({ error: "no_previous_chart" }, { status: 404 });
  }

  return NextResponse.json({
    id: chart.id,
    weekLabel: chart.weekLabel,
    dateRange: chart.dateRange,
    entries: chart.entries.map((e) => ({
      title: e.song.title,
      artist: e.song.artist,
      album: e.song.album ?? "",
      spotifyId: e.song.spotifyId ?? null,
    })),
  });
}

