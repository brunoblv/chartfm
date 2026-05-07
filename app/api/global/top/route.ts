import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const { weekIndex } = getRankingWeekReference(new Date());

  const entries = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex }, position: { lte: 100 } },
    select: {
      position: true,
      points: true,
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          albumRef: { select: { coverUrl: true } },
        },
      },
    },
  });

  // Agrega pontos por música (mesmo critério da parada global)
  const map = new Map<string, { pts: number; song: (typeof entries)[number]["song"]; position: number }>();
  for (const e of entries) {
    const key = e.song.spotifyId
      ? `spotify:${e.song.spotifyId}`
      : `local:${e.song.title.trim().toLowerCase()}|${e.song.artist.trim().toLowerCase()}`;
    const pts = e.points > 0 ? e.points : 101 - e.position;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { pts, song: e.song, position: e.position });
    } else {
      cur.pts += pts;
      if (e.position < cur.position) cur.position = e.position;
    }
  }

  const top5 = [...map.values()]
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 5)
    .map((row) => ({
      id: row.song.id,
      title: row.song.title,
      artist: row.song.artist,
      album: row.song.album ?? "",
      spotifyId: row.song.spotifyId ?? null,
      coverUrl: row.song.albumRef?.coverUrl ?? null,
      points: row.pts,
    }));

  return NextResponse.json({ songs: top5, weekIndex });
}
