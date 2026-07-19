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
  spotifyConfigured,
} from "@/lib/spotify-server";
import { runWithSpotifyBackfillPool } from "@/lib/spotify-user-charts-pool";
import { findSpotifyTrackForSong } from "@/lib/spotify-track-match";
import { buildSongPath } from "@/lib/music-routes";

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
    {
      AND: [
        { albumSpotifyId: { not: null } },
        {
          OR: [
            { albumRef: null },
            { albumRef: { OR: [{ coverUrl: null }, { coverUrl: "" }] } },
          ],
        },
      ],
    },
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

async function updateSong(song: { id: string; title: string; artist: string; spotifyId: string | null }) {
  let spotifyId = song.spotifyId;
  if (!spotifyId) {
    // Sem fallback cego para o 1\u00ba resultado: s\u00f3 faixa validada (t\u00edtulo+artista)
    // em \u00e1lbum/single do pr\u00f3prio artista \u2014 colet\u00e2nea n\u00e3o entra no banco.
    const hit = await findSpotifyTrackForSong(song.title, song.artist);
    spotifyId = hit?.spotifyId ?? null;
  }
  if (!spotifyId) return { updated: false, reason: "spotify_track_not_found" };

  const meta = await getSpotifyTrackMetadataById(spotifyId);
  if (!meta) return { updated: false, reason: "spotify_track_metadata_missing" };

  const result = await applySpotifyMetadataToSong(song.id, meta, false);
  return { updated: result.ok, reason: result.reason };
}

function manualLabel(item: QueueItem) {
  if (item.type === "song") return `${item.ref.title} - ${item.ref.artist}`;
  if (item.type === "artist") return item.ref.name;
  return `${item.ref.title} - ${item.ref.artist.name}`;
}

function manualHref(item: QueueItem) {
  if (item.type === "song") {
    return `${buildSongPath({
      id: item.ref.id,
      title: item.ref.title,
      artist: item.ref.artist,
      spotifyId: item.ref.spotifyId,
    })}/edit`;
  }
  if (item.type === "artist") return `/artist/${item.ref.id}/edit`;
  return `/album/${item.ref.artist.id}_${item.ref.id}/edit`;
}

async function makeManualItem(item: QueueItem, reason: string) {
  const manualItem: {
    type: "song" | "artist" | "album";
    id: string;
    label: string;
    href: string;
    reason: string;
    conflict?: { label: string; href: string };
  } = {
    type: item.type,
    id: item.type === "song" ? item.ref.id : item.ref.spotifyId,
    label: manualLabel(item),
    href: manualHref(item),
    reason,
  };

  if (reason.startsWith("spotify_id_conflict:")) {
    const conflictSongId = reason.split(":")[1]?.trim();
    if (conflictSongId) {
      const conflictSong = await prisma.song.findUnique({
        where: { id: conflictSongId },
        select: { id: true, title: true, artist: true, spotifyId: true },
      });
      if (conflictSong) {
        manualItem.conflict = {
          label: `${conflictSong.title} - ${conflictSong.artist}`,
          href: `${buildSongPath(conflictSong)}/edit`,
        };
      }
    }
  }

  return manualItem;
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

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    exclude?: {
      songIds?: unknown;
      artistSpotifyIds?: unknown;
      albumSpotifyIds?: unknown;
    };
  };
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH_SIZE));
  const excludedSongIds = new Set(Array.isArray(body.exclude?.songIds) ? body.exclude.songIds.filter((id): id is string => typeof id === "string") : []);
  const excludedArtistSpotifyIds = new Set(
    Array.isArray(body.exclude?.artistSpotifyIds) ? body.exclude.artistSpotifyIds.filter((id): id is string => typeof id === "string") : [],
  );
  const excludedAlbumSpotifyIds = new Set(
    Array.isArray(body.exclude?.albumSpotifyIds) ? body.exclude.albumSpotifyIds.filter((id): id is string => typeof id === "string") : [],
  );

  const [songs, artists, albums] = await Promise.all([
    prisma.song.findMany({
      where: { AND: [songMissingWhere, excludedSongIds.size ? { id: { notIn: [...excludedSongIds] } } : {}] },
      select: { id: true, title: true, artist: true, spotifyId: true },
      orderBy: [{ spotifyId: "desc" }, { artist: "asc" }, { title: "asc" }],
      take: limit,
    }),
    prisma.artist.findMany({
      where: { AND: [artistMissingWhere, excludedArtistSpotifyIds.size ? { spotifyId: { notIn: [...excludedArtistSpotifyIds] } } : {}] },
      select: { id: true, name: true, spotifyId: true },
      orderBy: { name: "asc" },
      take: limit,
    }),
    prisma.album.findMany({
      where: { AND: [albumMissingWhere, excludedAlbumSpotifyIds.size ? { spotifyId: { notIn: [...excludedAlbumSpotifyIds] } } : {}] },
      select: { id: true, title: true, spotifyId: true, artist: { select: { id: true, name: true } } },
      orderBy: { title: "asc" },
      take: limit,
    }),
  ]);

  const queue = [
    ...songs.map((song) => ({ type: "song" as const, ref: song })),
    ...artists.map((artist) => ({ type: "artist" as const, ref: artist })),
    ...albums.map((album) => ({ type: "album" as const, ref: album })),
  ].slice(0, limit);

  const { updated, skipped, failed, errors, manualItems } = await runWithSpotifyBackfillPool(async () => {
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const manualItems: {
      type: "song" | "artist" | "album";
      id: string;
      label: string;
      href: string;
      reason: string;
    }[] = [];

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
          manualItems.push(await makeManualItem(item, result.reason));
        }
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "update_failed";
        errors.push(`${item.type}: ${reason}`);
        manualItems.push(await makeManualItem(item, reason));
      }
    }

    return { updated, skipped, failed, errors, manualItems };
  });

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
    manualItems,
  });
}

type QueueItem =
  | { type: "song"; ref: { id: string; title: string; artist: string; spotifyId: string | null } }
  | { type: "artist"; ref: { id: number; name: string; spotifyId: string } }
  | { type: "album"; ref: { id: number; title: string; spotifyId: string; artist: { id: number; name: string } } };
