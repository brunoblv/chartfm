import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" };

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get("q")?.slice(0, 100) ?? "";
  const q = rawQ.replace(/\s+/g, " ").trim();
  if (q.length < 2) {
    return NextResponse.json({ songs: [], artists: [], albums: [], users: [] }, { headers: NO_CACHE });
  }
  const terms = (q.match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);

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
  const albumTermFilters = terms.map((term) => ({
    OR: [
      { title: { contains: term, mode: "insensitive" as const } },
      { artist: { name: { contains: term, mode: "insensitive" as const } } },
    ],
  }));

  const [songs, artists, albums, users] = await Promise.all([
    prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { artist: { contains: q, mode: "insensitive" as const } },
          ...(songTermFilters.length > 0 ? [{ AND: songTermFilters }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
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
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          ...(artistTermFilters.length > 0 ? [{ AND: artistTermFilters }] : []),
        ],
      },
      select: { spotifyId: true, name: true, imageUrl: true },
      take: 4,
      orderBy: { name: "asc" },
    }),
    prisma.album.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { artist: { name: { contains: q, mode: "insensitive" as const } } },
          ...(albumTermFilters.length > 0 ? [{ AND: albumTermFilters }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        coverUrl: true,
        artist: { select: { id: true, name: true } },
      },
      take: 4,
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { handle: { contains: q, mode: "insensitive" as const } },
          ...(userTermFilters.length > 0 ? [{ AND: userTermFilters }] : []),
        ],
      },
      select: { handle: true, name: true, avatarColor: true, image: true },
      take: 3,
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json(
    {
      songs: songs.map((s) => ({
        id: s.id,
        title: s.exhibitionName?.trim() || s.title,
        artist: s.artist,
        album: s.album ?? null,
        spotifyId: s.spotifyId,
        artistSpotifyId: s.artistSpotifyId,
        coverUrl: s.albumRef?.coverUrl ?? null,
      })),
      artists,
      albums: albums.map((a) => ({
        id: a.id,
        title: a.exhibitionName?.trim() || a.title,
        artist: a.artist.name,
        artistId: a.artist.id,
        coverUrl: a.coverUrl,
      })),
      users,
    },
    { headers: NO_CACHE },
  );
}
