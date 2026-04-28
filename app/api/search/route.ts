import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) {
    return NextResponse.json({ songs: [], artists: [], users: [] });
  }

  const [songs, artists, users] = await Promise.all([
    prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { artist: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        artistSpotifyId: true,
        albumRef: { select: { coverUrl: true } },
      },
      take: 5,
      orderBy: { title: "asc" },
    }),
    prisma.artist.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { spotifyId: true, name: true, imageUrl: true },
      take: 4,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { handle: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { handle: true, name: true, avatarColor: true, image: true },
      take: 3,
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    songs: songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      spotifyId: s.spotifyId,
      artistSpotifyId: s.artistSpotifyId,
      coverUrl: s.albumRef?.coverUrl ?? null,
    })),
    artists,
    users,
  });
}
