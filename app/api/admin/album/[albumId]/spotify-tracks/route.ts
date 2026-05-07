import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { listSpotifyAlbumTracks, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ albumId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { albumId } = await context.params;
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_album_id" }, { status: 400 });

  const album = await prisma.album.findUnique({
    where: { id },
    select: { spotifyId: true },
  });
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!spotifyConfigured()) {
    return NextResponse.json({
      configured: false,
      tracks: [],
      message: "Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env",
    });
  }

  const spotifyId = album.spotifyId.trim();
  if (!spotifyId) {
    return NextResponse.json({ configured: true, tracks: [], message: "Álbum sem Spotify ID." });
  }

  const tracks = await listSpotifyAlbumTracks(spotifyId, "BR");
  if (tracks.length === 0) {
    return NextResponse.json({ configured: true, tracks: [], message: "Nenhuma faixa retornada pelo Spotify." });
  }

  const ids = tracks.map((t) => t.spotifyId);
  const onThisAlbum = await prisma.song.findMany({
    where: { spotifyId: { in: ids }, albumSpotifyId: spotifyId },
    select: { spotifyId: true },
  });
  const onAlbumIds = new Set(onThisAlbum.map((s) => s.spotifyId).filter(Boolean) as string[]);

  return NextResponse.json({
    configured: true,
    tracks: tracks.map((t) => ({
      spotifyId: t.spotifyId,
      title: t.title,
      inDatabase: onAlbumIds.has(t.spotifyId),
    })),
  });
}
