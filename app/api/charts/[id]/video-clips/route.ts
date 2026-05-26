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

  // Clips escolhidos pelo dono da parada
  const choices = await prisma.userSongVideoClipChoice.findMany({
    where: { userId: chart.userId, songId: { in: songIds } },
    select: { songId: true, clip: { select: { imageUrl: true } } },
  });

  const map: Record<string, string> = {};
  const chosenSongIds = new Set<string>();

  for (const choice of choices) {
    map[choice.songId] = choice.clip.imageUrl;
    chosenSongIds.add(choice.songId);
  }

  // Para músicas sem escolha do dono, usar o clip mais votado como padrão
  const unchosenIds = songIds.filter((id) => !chosenSongIds.has(id));
  if (unchosenIds.length > 0) {
    const topClips = await prisma.songVideoClip.findMany({
      where: { songId: { in: unchosenIds } },
      orderBy: { votes: "desc" },
      select: { songId: true, imageUrl: true },
    });

    // Keep only the first (most voted) clip per song
    for (const clip of topClips) {
      if (!map[clip.songId]) {
        map[clip.songId] = clip.imageUrl;
      }
    }
  }

  return NextResponse.json(map);
}
