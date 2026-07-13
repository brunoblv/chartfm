import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "@/lib/spotify-server";
import { applySpotifyMetadataToSong } from "@/lib/apply-spotify-metadata-to-song";
import { refreshSnapshotsForSong } from "@/lib/entity-page-snapshot/refresh-song";

export const runtime = "nodejs";

function extractSpotifyTrackId(input: string): string | null {
  const trimmed = input.trim();
  // Handle full URLs: https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp
  // or https://open.spotify.com/intl-pt/track/3n3Ppam7vgaVa1iaRUc9Lp?...
  const urlMatch = trimmed.match(/open\.spotify\.com(?:\/intl-[a-z]+)?\/track\/([A-Za-z0-9]{22})/);
  if (urlMatch) return urlMatch[1];
  // Handle bare Spotify track IDs (22 alphanumeric chars)
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!spotifyConfigured()) return NextResponse.json({ error: "spotify_not_configured" }, { status: 503 });

  const { songId } = await context.params;
  const id = songId.trim();
  if (!id) return NextResponse.json({ error: "invalid_song_id" }, { status: 400 });

  const song = await prisma.song.findUnique({
    where: { id },
    select: { id: true, title: true, artist: true, spotifyId: true, _count: { select: { entries: true } } },
  });
  if (!song) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: { spotifyUrl?: unknown; preview?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const spotifyUrl = typeof body.spotifyUrl === "string" ? body.spotifyUrl.trim() : "";
  if (!spotifyUrl) return NextResponse.json({ error: "spotify_url_required" }, { status: 400 });

  const trackId = extractSpotifyTrackId(spotifyUrl);
  if (!trackId) return NextResponse.json({ error: "invalid_spotify_url" }, { status: 400 });

  const meta = await getSpotifyTrackMetadataById(trackId);
  if (!meta) return NextResponse.json({ error: "track_not_found_on_spotify" }, { status: 404 });

  // preview=true returns track info without saving
  if (body.preview === true) {
    return NextResponse.json({
      preview: {
        spotifyId: meta.spotifyId,
        title: meta.title,
        artist: meta.artistDisplay,
        album: meta.album.title,
        coverUrl: meta.album.coverUrl,
        spotifyUrl: meta.spotifyUrl,
        entriesAffected: song._count.entries,
      },
    });
  }

  const result = await applySpotifyMetadataToSong(id, meta, false);

  if (!result.ok) {
    if (result.reason.startsWith("spotify_id_conflict:")) {
      const conflictId = result.reason.split(":")[1];

      // Merge wrong song into correct song: migrate all chart entries then delete wrong song
      await prisma.$transaction(async (tx) => {
        await tx.chartEntry.updateMany({
          where: { songId: id },
          data: { songId: conflictId, songSpotifyId: meta.spotifyId, albumSpotifyId: meta.album.spotifyId ?? null },
        });
        // Clear any remaining songSpotifyId references to the old spotify ID
        if (song.spotifyId) {
          await tx.chartEntry.updateMany({
            where: { songSpotifyId: song.spotifyId },
            data: { songSpotifyId: meta.spotifyId },
          });
        }
        await tx.song.delete({ where: { id } });
      });

      void refreshSnapshotsForSong(conflictId);

      return NextResponse.json({
        ok: true,
        merged: true,
        updated: {
          songId: conflictId,
          spotifyId: meta.spotifyId,
          title: meta.title,
          artist: meta.artistDisplay,
          album: meta.album.title,
          entriesUpdated: song._count.entries,
        },
      });
    }
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  void refreshSnapshotsForSong(id);

  return NextResponse.json({
    ok: true,
    updated: {
      songId: id,
      spotifyId: meta.spotifyId,
      title: meta.title,
      artist: meta.artistDisplay,
      album: meta.album.title,
      entriesUpdated: song._count.entries,
    },
  });
}
