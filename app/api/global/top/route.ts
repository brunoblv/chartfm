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

  const sorted = [...map.values()].sort((a, b) => b.count - a.count);

  console.log("[global/top] entries brutas:", entries.length);
  console.log("[global/top] músicas únicas:", map.size);
  console.log("[global/top] ranking completo:");
  sorted.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.song.artist} — ${row.song.title} | plays: ${row.count}`);
  });

  const top5 = sorted.slice(0, 5).map((row) => ({
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
