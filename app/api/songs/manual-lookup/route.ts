import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" };

/** Autocomplete de artista/álbum já cadastrados — usado no cadastro manual de música (Spotify indisponível). */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [] }, { headers: NO_CACHE });

  if (kind === "artist") {
    const rows = await prisma.artist.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { spotifyId: true, name: true },
      orderBy: { name: "asc" },
      take: 12,
    });
    return NextResponse.json({ items: rows }, { headers: NO_CACHE });
  }

  if (kind === "album") {
    const artistSpotifyId = req.nextUrl.searchParams.get("artistSpotifyId")?.trim() || undefined;
    const rows = await prisma.album.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        ...(artistSpotifyId ? { artistSpotifyId } : {}),
      },
      select: { spotifyId: true, title: true, artist: { select: { name: true } } },
      orderBy: { title: "asc" },
      take: 12,
    });
    return NextResponse.json(
      { items: rows.map((r) => ({ spotifyId: r.spotifyId, title: r.title, artistName: r.artist.name })) },
      { headers: NO_CACHE },
    );
  }

  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}
