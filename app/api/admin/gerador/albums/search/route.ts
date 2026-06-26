import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  const albums = await prisma.album.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { exhibitionName: { contains: q, mode: "insensitive" } },
        { artist: { name: { contains: q, mode: "insensitive" } } },
        { artist: { exhibitionName: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      coverUrl: true,
      releaseDate: true,
      artist: { select: { name: true, exhibitionName: true } },
    },
    orderBy: { title: "asc" },
    take: 25,
  });

  if (albums.length === 0) return NextResponse.json({ items: [] });

  const stats = await prisma.albumReview.groupBy({
    by: ["albumId"],
    where: { albumId: { in: albums.map((a) => a.id) } },
    _avg: { rating: true },
    _count: { id: true },
  });
  const statsById = new Map(stats.map((s) => [s.albumId, s]));

  const items = albums.map((a) => {
    const s = statsById.get(a.id);
    const reviewCount = s?._count.id ?? 0;
    const avg = s?._avg.rating ?? 0;
    return {
      id: a.id,
      title: a.exhibitionName || a.title,
      artist: a.artist.exhibitionName || a.artist.name,
      year: a.releaseDate ? String(a.releaseDate.getFullYear()) : "—",
      score: reviewCount > 0 ? Math.round(avg) : 0,
      reviewCount,
      coverUrl: a.coverUrl ?? null,
    };
  });

  return NextResponse.json({ items });
}
