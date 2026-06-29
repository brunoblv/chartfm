import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  fetchAndSaveSongGenres,
  resolveSongGenres,
  songGenresBackfillOrderBy,
  songMissingGenresWhere,
} from "@/lib/resolve-song-genres";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BATCH_SIZE = 2;
const BATCH_DELAY_MS = 500;

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

type BackfillBody = {
  limit?: number;
  exclude?: { songIds?: string[] };
  songId?: string;
};

export async function GET() {
  const auth = await ensurePrivilegedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const [total, bySource] = await Promise.all([
    prisma.song.count({ where: songMissingGenresWhere }),
    prisma.song.groupBy({
      by: ["genreSource"],
      _count: { _all: true },
      where: { genresFetchedAt: { not: null } },
    }),
  ]);

  const withTags = await prisma.song.count({ where: { genres: { isEmpty: false } } });
  const songCount = await prisma.song.count();

  return NextResponse.json({
    missing: total,
    withTags,
    totalSongs: songCount,
    bySource: bySource.map((r) => ({
      source: r.genreSource ?? "unknown",
      count: r._count._all,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await ensurePrivilegedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as BackfillBody;
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(body.limit ?? MAX_BATCH_SIZE)));
  const excludeIds = body.exclude?.songIds ?? [];

  if (body.songId) {
    const resolved = await fetchAndSaveSongGenres(prisma, body.songId);
    if (!resolved) {
      return NextResponse.json({ ok: false, message: "Música não encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      processed: 1,
      updated: resolved.genres.length > 0 ? 1 : 0,
      results: [
        {
          songId: body.songId,
          genres: resolved.genres,
          source: resolved.source,
          recordingMbid: resolved.recordingMbid,
        },
      ],
    });
  }

  const where: Prisma.SongWhereInput = {
    AND: [
      songMissingGenresWhere,
      excludeIds.length ? { id: { notIn: excludeIds } } : {},
    ],
  };

  const songs = await prisma.song.findMany({
    where,
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      isrc: true,
      recordingMbid: true,
      artistRef: { select: { genres: true } },
    },
    orderBy: songGenresBackfillOrderBy,
    take: limit,
  });

  const remaining = await prisma.song.count({
    where: {
      AND: [
        songMissingGenresWhere,
        { id: { notIn: [...excludeIds, ...songs.map((s) => s.id)] } },
      ],
    },
  });

  if (!songs.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      updated: 0,
      failed: 0,
      remaining: 0,
      message: "Nenhuma música pendente.",
      results: [],
    });
  }

  const results: Array<{
    songId: string;
    title: string;
    artist: string;
    genres: string[];
    source: string;
    recordingMbid: string | null;
    error?: string;
  }> = [];

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]!;
    if (i > 0) await sleep(BATCH_DELAY_MS);

    try {
      const resolved = await resolveSongGenres({
        title: song.title,
        artist: song.artist,
        spotifyId: song.spotifyId,
        isrc: song.isrc,
        recordingMbid: song.recordingMbid,
        artistGenres: song.artistRef?.genres,
      });

      await prisma.song.update({
        where: { id: song.id },
        data: {
          genres: resolved.genres,
          genreSource: resolved.source,
          recordingMbid: resolved.recordingMbid,
          genresFetchedAt: new Date(),
        },
      });

      if (resolved.genres.length > 0) updated++;
      results.push({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        genres: resolved.genres,
        source: resolved.source,
        recordingMbid: resolved.recordingMbid,
      });
    } catch (err) {
      failed++;
      results.push({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        genres: [],
        source: "error",
        recordingMbid: null,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: songs.length,
    updated,
    failed,
    remaining,
    results,
  });
}
