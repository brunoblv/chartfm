import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { findConflictingSong, findSongConflictByTitleArtist } from "@/lib/duplicate-registration-guards";
import { songConflictBody } from "@/lib/duplicate-conflict-payload";
import { isPrivilegedRole } from "@/lib/permissions";
import { refreshSnapshotsForSong } from "@/lib/entity-page-snapshot/refresh-song";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { songId } = await context.params;
  const id = songId.trim();
  if (!id) return NextResponse.json({ error: "invalid_song_id" }, { status: 400 });

  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      artist: true,
      album: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      spotifyId: true,
    },
  });
  if (!song) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ song });
}

type PatchBody = {
  title?: unknown;
  spotifyId?: unknown;
  romanization?: unknown;
  artistSpotifyId?: unknown;
  albumSpotifyId?: unknown;
  editorialNote?: unknown;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { songId } = await context.params;
  const id = songId.trim();
  if (!id) return NextResponse.json({ error: "invalid_song_id" }, { status: 400 });

  const body = (await req.json()) as PatchBody;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const spotifyId = typeof body.spotifyId === "string" ? body.spotifyId.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";
  const artistSpotifyId = typeof body.artistSpotifyId === "string" ? body.artistSpotifyId.trim() : "";
  const albumSpotifyId = typeof body.albumSpotifyId === "string" ? body.albumSpotifyId.trim() : "";
  const editorialNote = typeof body.editorialNote === "string" ? body.editorialNote.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!artistSpotifyId) return NextResponse.json({ error: "artist_required" }, { status: 400 });

  const existing = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      spotifyId: true,
      albumRef: { select: { id: true } },
      artistRef: { select: { id: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

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

  const titlesToCheck = [title, ...(romanization ? [romanization] : [])];
  const conflicting = await findConflictingSong(prisma, {
    artistSpotifyId: artist.spotifyId,
    titles: titlesToCheck,
    excludeSongId: id,
    allowSpotifyId: spotifyId || existing.spotifyId,
  });
  if (conflicting) {
    return NextResponse.json(songConflictBody(conflicting), { status: 409 });
  }

  try {
    const updated = await prisma.song.update({
      where: { id },
      data: {
        title,
        spotifyId: spotifyId || null,
        exhibitionName: romanization || null,
        artist: artist.name,
        artistSpotifyId: artist.spotifyId,
        album: album?.title ?? null,
        albumSpotifyId: album?.spotifyId ?? null,
        editorialNote: editorialNote || null,
      },
      select: {
        id: true,
        title: true,
        exhibitionName: true,
        spotifyId: true,
        artist: true,
        album: true,
        artistSpotifyId: true,
        albumSpotifyId: true,
        editorialNote: true,
      },
    });
    void refreshSnapshotsForSong(id, {
      previousAlbumId: existing.albumRef?.id ?? null,
      previousArtistId: existing.artistRef?.id ?? null,
    });
    return NextResponse.json({ song: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      const raceConflict =
        (await findConflictingSong(prisma, {
          artistSpotifyId: artist.spotifyId,
          titles: titlesToCheck,
          excludeSongId: id,
        })) ?? (await findSongConflictByTitleArtist(prisma, title, artist.name, artist.spotifyId));
      if (raceConflict) return NextResponse.json(songConflictBody(raceConflict), { status: 409 });
      return NextResponse.json({ error: "song_already_exists_same_title_artist" }, { status: 409 });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
