import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  countSongsMissingCovers,
  enrichSongsWithSpotifyMetadataByIds,
  findSongsMissingCovers,
} from "@/lib/resolve-publish-songs";
import { isSpotifyTrackId, probeSpotifyApi, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BATCH = 50;

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET() {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  const [total, sample] = await Promise.all([
    countSongsMissingCovers(prisma),
    findSongsMissingCovers(prisma, 30),
  ]);

  return NextResponse.json({
    ok: true,
    configured: spotifyConfigured(),
    total,
    invalidIds: sample.filter((s) => s.spotifyId && !isSpotifyTrackId(s.spotifyId)).length,
  });
}

export async function POST(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  if (!spotifyConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, message: "Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env." },
      { status: 400 },
    );
  }

  const probe = await probeSpotifyApi();
  if (!probe.ok) {
    return NextResponse.json({ ok: false, configured: true, message: probe.error }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    excludeSongIds?: unknown;
  };
  const limit = Math.min(MAX_BATCH, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH));
  const excluded = new Set(
    Array.isArray(body.excludeSongIds)
      ? body.excludeSongIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
  );

  const candidates = await findSongsMissingCovers(prisma);
  const batch = candidates.filter((s) => !excluded.has(s.id)).slice(0, limit);
  if (batch.length === 0) {
    return NextResponse.json({
      ok: true,
      configured: true,
      processed: 0,
      updated: 0,
      skipped: 0,
      viaBatch: 0,
      viaSearch: 0,
      remaining: 0,
      failedItems: [],
    });
  }

  const batchIds = new Set(batch.map((s) => s.id));
  const result = await enrichSongsWithSpotifyMetadataByIds(prisma, batch.map((s) => s.id), {
    searchFallback: true,
  });
  const remaining = await countSongsMissingCovers(prisma);
  const stillMissing = await findSongsMissingCovers(prisma);
  const failedItems = stillMissing
    .filter((s) => batchIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      spotifyId: s.spotifyId,
      invalidSpotifyId: Boolean(s.spotifyId && !isSpotifyTrackId(s.spotifyId)),
    }));

  return NextResponse.json({
    ok: true,
    configured: true,
    processed: batch.length,
    updated: result.updated,
    skipped: result.skipped,
    viaBatch: result.viaBatch,
    viaSearch: result.viaSearch,
    invalidSpotifyIds: result.invalidSpotifyIds,
    tokenMissing: result.tokenMissing,
    remaining,
    failedItems,
  });
}
