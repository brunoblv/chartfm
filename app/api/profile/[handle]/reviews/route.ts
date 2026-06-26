import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const url = new URL(_req.url);
    const { handle: raw } = await context.params;
    const handle = decodeURIComponent(raw ?? "").trim();
    if (!handle) {
      return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
    }

    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const perPageRaw = Number(url.searchParams.get("perPage") ?? "12");
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const perPage = Number.isFinite(perPageRaw) && perPageRaw > 0 ? Math.min(50, Math.floor(perPageRaw)) : 12;

    const user = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const where = { userId: user.id };

    const [total, rows] = await Promise.all([
      prisma.albumReview.count({ where }),
      prisma.albumReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          rating: true,
          body: true,
          helpful: true,
          createdAt: true,
          album: {
            select: {
              id: true,
              title: true,
              exhibitionName: true,
              coverUrl: true,
              artist: {
                select: { name: true, exhibitionName: true },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        helpful: r.helpful,
        createdAt: r.createdAt.toISOString(),
        album: {
          id: r.album.id,
          title: r.album.exhibitionName || r.album.title,
          coverUrl: r.album.coverUrl ?? null,
          artistName: r.album.artist.exhibitionName || r.album.artist.name,
        },
      })),
      page,
      perPage,
      total,
    });
  } catch (err) {
    console.error("[GET /api/profile/[handle]/reviews]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
