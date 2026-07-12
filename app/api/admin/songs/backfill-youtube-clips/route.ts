import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  countSongsWithoutClips,
  findSongsWithoutClips,
  searchAndCreateYouTubeClip,
  createManualReviewFlag,
} from "@/lib/youtube-music-clip-backfill";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BATCH = 30;
const REQUEST_TIME_BUDGET_MS = 35_000;

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: session.user.id };
}

export async function GET() {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  const [total, sample] = await Promise.all([
    countSongsWithoutClips(),
    findSongsWithoutClips(30),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    sample: sample.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
    })),
  });
}

export async function POST(req: NextRequest) {
  const deadlineAt = Date.now() + REQUEST_TIME_BUDGET_MS;
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    excludeSongIds?: unknown;
    markForReview?: unknown;
  };

  const limit = Math.min(MAX_BATCH, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH));
  const excluded = new Set(
    Array.isArray(body.excludeSongIds)
      ? body.excludeSongIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
  );

  const markForReview = Array.isArray(body.markForReview)
    ? body.markForReview.filter((id): id is string => typeof id === "string")
    : [];

  const candidates = await findSongsWithoutClips(limit + excluded.size);
  const batch = candidates.filter((s) => !excluded.has(s.id)).slice(0, limit);

  if (batch.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      found: 0,
      needsReview: 0,
      errors: 0,
      remaining: 0,
      failedItems: [],
    });
  }

  const batchIds = new Set(batch.map((s) => s.id));
  let found = 0;
  let needsReview = 0;
  let errors = 0;
  const failedItems: Array<{
    id: string;
    title: string;
    artist: string;
    reason: string;
  }> = [];

  const startTime = Date.now();
  for (const song of batch) {
    if (Date.now() - startTime > REQUEST_TIME_BUDGET_MS * 0.8) break;

    const result = await searchAndCreateYouTubeClip(song.id, song.title, song.artist, guard.userId);

    if (result.error) {
      errors += 1;
      failedItems.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        reason: result.error,
      });
    } else if (result.found) {
      found += 1;
    } else if (result.needsManualReview) {
      needsReview += 1;
      await createManualReviewFlag(song.id, `Nenhum video clipe encontrado para "${song.title}" por ${song.artist}`);
    }
  }

  // Marcar para revisão manual se solicitado
  for (const songId of markForReview) {
    if (batchIds.has(songId)) {
      await createManualReviewFlag(songId, "Marcado para revisão manual pelo admin");
    }
  }

  const remaining = await countSongsWithoutClips();

  return NextResponse.json({
    ok: true,
    processed: batch.length,
    found,
    needsReview,
    errors,
    remaining,
    failedItems,
  });
}
