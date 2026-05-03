import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

function mergeBySpotifyId<T extends { spotifyId: string }>(rows: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.spotifyId)) continue;
    seen.add(r.spotifyId);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  const albumSelect = {
    spotifyId: true,
    title: true,
    artist: { select: { name: true } },
  } as const;

  if (kind === "artist") {
    let rows: { spotifyId: string; name: string }[];
    if (q.length === 1) {
      const select = { spotifyId: true, name: true } as const;
      const [exact, prefix, rest] = await Promise.all([
        prisma.artist.findMany({
          where: { name: { equals: q, mode: "insensitive" } },
          select,
          take: 20,
        }),
        prisma.artist.findMany({
          where: {
            name: { startsWith: q, mode: "insensitive" },
            NOT: { name: { equals: q, mode: "insensitive" } },
          },
          select,
          orderBy: { name: "asc" },
          take: 35,
        }),
        prisma.artist.findMany({
          where: {
            AND: [
              { name: { contains: q, mode: "insensitive" } },
              { NOT: { name: { startsWith: q, mode: "insensitive" } } },
            ],
          },
          select,
          orderBy: { name: "asc" },
          take: 25,
        }),
      ]);
      rows = mergeBySpotifyId([...exact, ...prefix, ...rest], 40);
    } else {
      rows = await prisma.artist.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { spotifyId: true, name: true },
        orderBy: { name: "asc" },
        take: 40,
      });
    }
    return NextResponse.json({ items: rows });
  }

  if (kind === "album") {
    let rows: { spotifyId: string; title: string; artist: { name: string } }[];
    if (q.length === 1) {
      const [exact, prefix, rest] = await Promise.all([
        prisma.album.findMany({
          where: { title: { equals: q, mode: "insensitive" } },
          select: albumSelect,
          take: 20,
        }),
        prisma.album.findMany({
          where: {
            title: { startsWith: q, mode: "insensitive" },
            NOT: { title: { equals: q, mode: "insensitive" } },
          },
          select: albumSelect,
          orderBy: { title: "asc" },
          take: 35,
        }),
        prisma.album.findMany({
          where: {
            AND: [
              { title: { contains: q, mode: "insensitive" } },
              { NOT: { title: { startsWith: q, mode: "insensitive" } } },
            ],
          },
          select: albumSelect,
          orderBy: { title: "asc" },
          take: 25,
        }),
      ]);
      rows = mergeBySpotifyId([...exact, ...prefix, ...rest], 45);
    } else {
      rows = await prisma.album.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: albumSelect,
        orderBy: { title: "asc" },
        take: 40,
      });
    }
    return NextResponse.json({
      items: rows.map((r) => ({ spotifyId: r.spotifyId, title: r.title, artistName: r.artist.name })),
    });
  }

  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}
