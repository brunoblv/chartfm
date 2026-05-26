import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const chart = await prisma.chart.findUnique({
    where: { id },
    select: {
      userId: true,
      entries: { select: { songId: true } },
    },
  });

  if (!chart) {
    return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
  }

  const songIds = chart.entries.map((e) => e.songId);

  if (songIds.length === 0) {
    return NextResponse.json({});
  }

  const clips = await prisma.userSongVideoClip.findMany({
    where: { userId: chart.userId, songId: { in: songIds } },
    select: { songId: true, imageUrl: true },
  });

  const map: Record<string, string> = {};
  for (const clip of clips) {
    map[clip.songId] = clip.imageUrl;
  }

  return NextResponse.json(map);
}
