import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) {
    return NextResponse.json({ songs: [], artists: [], users: [] });
  }
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);

  const songTermFilters = terms.map((term) => ({
    OR: [
      { title: { contains: term, mode: "insensitive" as const } },
      { artist: { contains: term, mode: "insensitive" as const } },
    ],
  }));
  const artistTermFilters = terms.map((term) => ({
    name: { contains: term, mode: "insensitive" as const },
  }));
  const userTermFilters = terms.map((term) => ({
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { handle: { contains: term, mode: "insensitive" as const } },
    ],
  }));

  const [songs, artists, users] = await Promise.all([
    prisma.song.findMany({
      where: {
        AND: songTermFilters,
      },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        artistSpotifyId: true,
        albumRef: { select: { coverUrl: true } },
      },
      take: 5,
      orderBy: { title: "asc" },
    }),
    prisma.artist.findMany({
      where: { AND: artistTermFilters },
      select: { spotifyId: true, name: true, imageUrl: true },
      take: 4,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        AND: userTermFilters,
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
      album: s.album ?? null,
      spotifyId: s.spotifyId,
      artistSpotifyId: s.artistSpotifyId,
      coverUrl: s.albumRef?.coverUrl ?? null,
    })),
    artists,
    users,
  });
}
