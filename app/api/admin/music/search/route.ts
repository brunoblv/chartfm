import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  if (kind === "artist") {
    const rows = await prisma.artist.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { spotifyId: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    });
    return NextResponse.json({ items: rows });
  }

  if (kind === "album") {
    const rows = await prisma.album.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: {
        spotifyId: true,
        title: true,
        artist: { select: { name: true } },
      },
      orderBy: { title: "asc" },
      take: 20,
    });
    return NextResponse.json({
      items: rows.map((r) => ({ spotifyId: r.spotifyId, title: r.title, artistName: r.artist.name })),
    });
  }

  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}
