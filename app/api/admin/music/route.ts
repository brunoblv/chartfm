import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { getSpotifyTrackMetadataById } from "@/lib/spotify-server";
import { upsertSongFromSpotifyMetadata } from "@/lib/upsert-song-from-spotify-metadata";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

type PostBody = {
  trackSpotifyId?: unknown;
  title?: unknown;
  artistSpotifyId?: unknown;
  albumSpotifyId?: unknown;
  spotifyId?: unknown;
  romanization?: unknown;
};

/** Cadastra ou atualiza uma música a partir do Spotify ou de campos manuais (artista já cadastrado). */
export async function POST(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const body = (await req.json()) as PostBody;

  const trackSpotifyId = typeof body.trackSpotifyId === "string" ? body.trackSpotifyId.trim() : "";
  if (trackSpotifyId) {
    const metadata = await getSpotifyTrackMetadataById(trackSpotifyId);
    if (!metadata) {
      return NextResponse.json(
        { error: "spotify_metadata_failed", message: "Não foi possível obter os dados da faixa no Spotify." },
        { status: 502 },
      );
    }
    const result = await upsertSongFromSpotifyMetadata(metadata);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ song: result.song });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artistSpotifyId = typeof body.artistSpotifyId === "string" ? body.artistSpotifyId.trim() : "";
  const albumSpotifyId = typeof body.albumSpotifyId === "string" ? body.albumSpotifyId.trim() : "";
  const spotifyId = typeof body.spotifyId === "string" ? body.spotifyId.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!artistSpotifyId) return NextResponse.json({ error: "artist_required" }, { status: 400 });

  const artist = await prisma.artist.findUnique({
    where: { spotifyId: artistSpotifyId },
    select: { spotifyId: true, name: true },
  });
  if (!artist) return NextResponse.json({ error: "artist_not_found" }, { status: 404 });

  const album = albumSpotifyId
    ? await prisma.album.findUnique({
        where: { spotifyId: albumSpotifyId },
        select: { spotifyId: true, title: true },
      })
    : null;
  if (albumSpotifyId && !album) return NextResponse.json({ error: "album_not_found" }, { status: 404 });

  if (spotifyId) {
    const taken = await prisma.song.findUnique({ where: { spotifyId }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "spotify_id_already_used" }, { status: 409 });
  }

  try {
    const song = await prisma.song.create({
      data: {
        title,
        artist: artist.name,
        spotifyId: spotifyId || null,
        exhibitionName: romanization || null,
        artistSpotifyId: artist.spotifyId,
        album: album?.title ?? null,
        albumSpotifyId: album?.spotifyId ?? null,
      },
      select: { id: true, title: true, artist: true, spotifyId: true, trackNumber: true },
    });
    return NextResponse.json({ song });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "song_already_exists_same_title_artist" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
