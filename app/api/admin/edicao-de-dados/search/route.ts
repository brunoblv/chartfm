import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * Busca incremental do admin de edição de dados.
 * Devolve linhas ricas (com gêneros/tags) para músicas, álbuns e artistas,
 * para que o gestor verifique as tags direto na tabela.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  if (kind === "music") {
    const rows = await prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { artist: { contains: q, mode: "insensitive" } },
          { album: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        genres: true,
        genreSource: true,
        artistRef: { select: { genres: true } },
      },
      take: 40,
      orderBy: { title: "asc" },
    });
    return NextResponse.json({
      items: rows.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        spotifyId: s.spotifyId,
        genres: s.genres,
        genreSource: s.genreSource,
        artistGenres: s.artistRef?.genres ?? [],
      })),
    });
  }

  if (kind === "albums") {
    // Álbum não tem campo de gênero no schema — herda as tags do artista.
    const rows = await prisma.album.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        spotifyId: true,
        albumType: true,
        releaseDate: true,
        artist: { select: { id: true, name: true, spotifyId: true, genres: true } },
        songs: { select: { id: true, title: true, artist: true }, orderBy: { title: "asc" } },
      },
      take: 40,
      orderBy: { title: "asc" },
    });
    return NextResponse.json({
      items: rows.map((a) => ({
        id: a.id,
        title: a.title,
        spotifyId: a.spotifyId,
        albumType: a.albumType,
        releaseDate: a.releaseDate,
        artist: a.artist,
        artistGenres: a.artist.genres,
        songs: a.songs,
      })),
    });
  }

  if (kind === "artists") {
    const rows = await prisma.artist.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { exhibitionName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        exhibitionName: true,
        spotifyId: true,
        imageUrl: true,
        genres: true,
      },
      take: 40,
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ items: rows });
  }

  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}
