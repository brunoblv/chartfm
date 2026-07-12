import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { searchAndCreateYouTubeClip, createManualReviewFlag } from "@/lib/youtube-music-clip-backfill";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: session.user.id };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  const { songId } = await params;

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      artist: true,
      videoClips: {
        select: { id: true, youtubeId: true },
        take: 1,
      },
    },
  });

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  if (song.videoClips.length > 0) {
    return NextResponse.json({
      ok: true,
      message: "Música já possui um clipe",
      found: true,
      youtubeId: song.videoClips[0].youtubeId,
    });
  }

  const result = await searchAndCreateYouTubeClip(songId, song.title, song.artist, guard.userId);

  if (result.found) {
    return NextResponse.json({
      ok: true,
      found: true,
      videoId: result.videoId,
      title: result.title,
      publishedAt: result.publishedAt,
      message: `Clipe encontrado: ${result.title}`,
    });
  } else if (result.needsManualReview) {
    await createManualReviewFlag(songId, `Nenhum video clipe encontrado para "${song.title}" por ${song.artist}`);
    return NextResponse.json({
      ok: true,
      found: false,
      needsManualReview: true,
      message: "Nenhum clipe encontrado. Marcado para revisão manual.",
    });
  } else {
    return NextResponse.json({
      ok: false,
      error: result.error || "Erro ao buscar clipe",
    }, { status: 400 });
  }
}
