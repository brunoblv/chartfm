import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";

export const runtime = "nodejs";

type Body = {
  title?: unknown;
  artist?: unknown;
  artistSpotifyId?: unknown;
  album?: unknown;
  albumSpotifyId?: unknown;
};

/**
 * Cadastro manual de música (tela de criar parada, quando o Spotify está indisponível).
 * Artista/álbum são resolvidos contra o catálogo local; se não encontrados, viram texto
 * livre — a música fica sem spotifyId até ser buscada depois (ver /admin/dados, filtro
 * "Criadas manualmente", e SourceFetchButtons para forçar a busca).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artistInput = typeof body.artist === "string" ? body.artist.trim() : "";
  const artistSpotifyId = typeof body.artistSpotifyId === "string" ? body.artistSpotifyId.trim() : "";
  const albumInput = typeof body.album === "string" ? body.album.trim() : "";
  const albumSpotifyId = typeof body.albumSpotifyId === "string" ? body.albumSpotifyId.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!artistInput) return NextResponse.json({ error: "artist_required" }, { status: 400 });
  if (isInstrumentalTitle(title)) {
    return NextResponse.json({ error: "instrumental_title" }, { status: 400 });
  }

  let artistName = artistInput;
  let resolvedArtistSpotifyId: string | null = null;
  if (artistSpotifyId) {
    const artist = await prisma.artist.findUnique({
      where: { spotifyId: artistSpotifyId },
      select: { spotifyId: true, name: true },
    });
    if (artist) {
      artistName = artist.name;
      resolvedArtistSpotifyId = artist.spotifyId;
    }
  }

  let albumTitle: string | null = albumInput || null;
  let resolvedAlbumSpotifyId: string | null = null;
  if (albumSpotifyId) {
    const album = await prisma.album.findUnique({
      where: { spotifyId: albumSpotifyId },
      select: { spotifyId: true, title: true },
    });
    if (album) {
      albumTitle = album.title;
      resolvedAlbumSpotifyId = album.spotifyId;
    }
  }

  const existing = await prisma.song.findFirst({
    where: { title: { equals: title, mode: "insensitive" }, artist: { equals: artistName, mode: "insensitive" } },
    select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumRef: { select: { coverUrl: true } } },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      song: {
        id: existing.id,
        title: existing.title,
        artist: existing.artist,
        album: existing.album,
        spotifyId: existing.spotifyId,
        imageUrl: existing.albumRef?.coverUrl ?? null,
      },
      reused: true,
    });
  }

  const song = await prisma.song.create({
    data: {
      title,
      artist: artistName,
      album: albumTitle,
      artistSpotifyId: resolvedArtistSpotifyId,
      albumSpotifyId: resolvedAlbumSpotifyId,
      createdManually: true,
    },
    select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumRef: { select: { coverUrl: true } } },
  });

  return NextResponse.json({
    ok: true,
    song: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      spotifyId: song.spotifyId,
      imageUrl: song.albumRef?.coverUrl ?? null,
    },
    reused: false,
  });
}
