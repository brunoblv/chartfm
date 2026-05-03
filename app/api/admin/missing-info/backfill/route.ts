import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { applySpotifyMetadataToSong } from "@/lib/apply-spotify-metadata-to-song";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getSpotifyAlbumMetadataById,
  getSpotifyArtistById,
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
  spotifyConfigured,
} from "@/lib/spotify-server";

export const runtime = "nodejs";

const MAX_BATCH_SIZE = 2;
const SPOTIFY_ITEM_DELAY_MS = 900;

const songMissingWhere: Prisma.SongWhereInput = {
  OR: [
    { spotifyId: null },
    { artistSpotifyId: null },
    { albumSpotifyId: null },
    { album: null },
    { album: "" },
    { coverImageUrl: null },
    { spotifyUrl: null },
    { durationMs: null },
  ],
};

const artistMissingWhere: Prisma.ArtistWhereInput = {
  OR: [{ imageUrl: null }, { spotifyUrl: null }, { genres: { isEmpty: true } }],
};

const albumMissingWhere: Prisma.AlbumWhereInput = {
  OR: [{ coverUrl: null }, { spotifyUrl: null }, { releaseDate: null }, { albumType: null }, { totalTracks: null }],
};

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSameTrack(candidate: { title: string; artist: string }, song: { title: string; artist: string }) {
  const title = normalize(song.title);
  const candidateTitle = normalize(candidate.title);
  const artist = normalize(song.artist);
  const candidateArtist = normalize(candidate.artist);
  return (
    (candidateTitle === title || candidateTitle.includes(title) || title.includes(candidateTitle)) &&
    (candidateArtist.includes(artist) || artist.includes(candidateArtist.split(",")[0]?.trim() ?? ""))
  );
}

async function updateSong(song: { id: string; title: string; artist: string; spotifyId: string | null }) {
  let spotifyId = song.spotifyId;
  if (!spotifyId) {
    const tracks = await searchSpotifyTracks(`${song.title} ${song.artist}`, 5);
    spotifyId = tracks.find((track) => looksLikeSameTrack(track, song))?.spotifyId ?? tracks[0]?.spotifyId ?? null;
  }
  if (!spotifyId) return { updated: false, reason: "spotify_track_not_found" };

  const meta = await getSpotifyTrackMetadataById(spotifyId);
  if (!meta) return { updated: false, reason: "spotify_track_metadata_missing" };

  const result = await applySpotifyMetadataToSong(song.id, meta, false);
  return { updated: result.ok, reason: result.reason };
}

async function updateArtist(artist: { spotifyId: string }) {
  const profile = await getSpotifyArtistById(artist.spotifyId);
  if (!profile) return { updated: false, reason: "spotify_artist_not_found" };

  await prisma.artist.update({
    where: { spotifyId: artist.spotifyId },
    data: {
      name: profile.name,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl,
      imageUrl: profile.imageUrl,
    },
  });
  return { updated: true, reason: "updated" };
}

async function updateAlbum(album: { spotifyId: string }) {
  const meta = await getSpotifyAlbumMetadataById(album.spotifyId);
  if (!meta) return { updated: false, reason: "spotify_album_not_found" };

  await prisma.album.update({
    where: { spotifyId: album.spotifyId },
    data: {
      title: meta.title ?? undefined,
      coverUrl: meta.coverUrl,
      albumType: meta.albumType ?? undefined,
      releaseDate: meta.releaseDate ?? undefined,
      spotifyUrl: meta.spotifyUrl,
      totalTracks: meta.totalTracks,
    },
  });

  if (meta.coverUrl) {
    await prisma.song.updateMany({
      where: { albumSpotifyId: album.spotifyId, OR: [{ coverImageUrl: null }, { coverImageUrl: "" }] },
      data: { coverImageUrl: meta.coverUrl },
    });
  }

  return { updated: true, reason: "updated" };
}

export async function POST(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  if (!spotifyConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, message: "Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH_SIZE));

  const [songs, artists, albums] = await Promise.all([
    prisma.song.findMany({
      where: songMissingWhere,
      select: { id: true, title: true, artist: true, spotifyId: true },
      orderBy: [{ spotifyId: "desc" }, { artist: "asc" }, { title: "asc" }],
      take: limit,
    }),
    prisma.artist.findMany({
      where: artistMissingWhere,
      select: { spotifyId: true },
      orderBy: { name: "asc" },
      take: limit,
    }),
    prisma.album.findMany({
      where: albumMissingWhere,
      select: { spotifyId: true },
      orderBy: { title: "asc" },
      take: limit,
    }),
  ]);

  const queue = [
    ...songs.map((song) => ({ type: "song" as const, ref: song })),
    ...artists.map((artist) => ({ type: "artist" as const, ref: artist })),
    ...albums.map((album) => ({ type: "album" as const, ref: album })),
  ].slice(0, limit);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const [index, item] of queue.entries()) {
    if (index > 0) await sleep(SPOTIFY_ITEM_DELAY_MS);

    try {
      const result =
        item.type === "song"
          ? await updateSong(item.ref)
          : item.type === "artist"
            ? await updateArtist(item.ref)
            : await updateAlbum(item.ref);

      if (result.updated) updated += 1;
      else {
        skipped += 1;
        errors.push(`${item.type}: ${result.reason}`);
      }
    } catch (err) {
      failed += 1;
      errors.push(`${item.type}: ${err instanceof Error ? err.message : "update_failed"}`);
    }
  }

  const [songRemaining, artistRemaining, albumRemaining] = await Promise.all([
    prisma.song.count({ where: songMissingWhere }),
    prisma.artist.count({ where: artistMissingWhere }),
    prisma.album.count({ where: albumMissingWhere }),
  ]);

  return NextResponse.json({
    ok: true,
    configured: true,
    processed: queue.length,
    updated,
    skipped,
    failed,
    remaining: songRemaining + artistRemaining + albumRemaining,
    errors: errors.slice(-6),
  });
}
