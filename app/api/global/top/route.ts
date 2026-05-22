import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const entries = await prisma.chartEntry.findMany({
    where: { chart: { publishedAt: { gte: since } } },
    select: {
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

  const map = new Map<string, { count: number; song: (typeof entries)[number]["song"] }>();
  for (const e of entries) {
    const key = e.song.spotifyId
      ? `spotify:${e.song.spotifyId}`
      : `local:${e.song.title.trim().toLowerCase()}|${e.song.artist.trim().toLowerCase()}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { count: 1, song: e.song });
    } else {
      cur.count += 1;
    }
  }

  const top5 = [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((row) => ({
      id: row.song.id,
      title: row.song.title,
      artist: row.song.artist,
      album: row.song.album ?? "",
      spotifyId: row.song.spotifyId ?? null,
      coverUrl: row.song.albumRef?.coverUrl ?? null,
      count: row.count,
    }));

  return NextResponse.json({ songs: top5 });
}
