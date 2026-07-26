import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  searchAndCreateYouTubeClip,
  createManualReviewFlag,
  fillYouTubeClipPublishedAt,
  assignManualYouTubeClip,
  clearManualReviewFlag,
} from "@/lib/youtube-music-clip-backfill";

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

  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    body = {};
  }

  if (body.action === "markMissing") {
    const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
    if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
    await createManualReviewFlag(songId);
    return NextResponse.json({
      ok: true,
      found: false,
      needsManualReview: true,
      message: "Marcado como sem clipe (revisão manual).",
    });
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      artist: true,
      musicVideoReleaseDate: true,
      youtubeReleaseDate: true,
      videoClips: {
        where: { youtubeId: { not: null } },
        select: { id: true, youtubeId: true, publishedAt: true },
        orderBy: { votes: "desc" },
        take: 1,
      },
    },
  });

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const existing = song.videoClips[0];
  if (existing?.youtubeId) {
    const needsDate =
      !existing.publishedAt || !song.musicVideoReleaseDate || !song.youtubeReleaseDate;

    if (needsDate) {
      const filled = await fillYouTubeClipPublishedAt(songId, existing.youtubeId);
      if (filled.error && !filled.publishedAt) {
        return NextResponse.json({ ok: false, error: filled.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        found: true,
        videoId: existing.youtubeId,
        title: filled.title,
        publishedAt: filled.publishedAt,
        message: filled.publishedAt
          ? `Data de postagem: ${filled.publishedAt.toISOString().slice(0, 10)}`
          : "Música já possui um clipe",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Música já possui um clipe",
      found: true,
      videoId: existing.youtubeId,
      publishedAt: existing.publishedAt,
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
      message: result.publishedAt
        ? `Clipe encontrado (${result.publishedAt.toISOString().slice(0, 10)}): ${result.title}`
        : `Clipe encontrado: ${result.title}`,
    });
  } else if (result.needsManualReview) {
    await createManualReviewFlag(songId);
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

/** Cadastro manual de clipe (ID ou URL do YouTube). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.status === 401 ? "unauthorized" : "forbidden" },
      { status: guard.status },
    );
  }

  const { songId } = await params;
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { youtubeIdOrUrl?: string };
  const raw = body.youtubeIdOrUrl?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Informe o ID ou URL do YouTube" }, { status: 400 });
  }

  const result = await assignManualYouTubeClip(songId, raw, guard.userId);
  if (!result.found) {
    return NextResponse.json({ ok: false, error: result.error ?? "Falha ao salvar" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    videoId: result.videoId,
    title: result.title,
    publishedAt: result.publishedAt,
    message: result.publishedAt
      ? `Clipe salvo (${result.publishedAt.toISOString().slice(0, 10)})`
      : "Clipe salvo",
  });
}

/** Remove evidência de clipe OFFICIAL e datas MV/YT (volta a exigir refill). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.status === 401 ? "unauthorized" : "forbidden" },
      { status: guard.status },
    );
  }

  const { songId } = await params;
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.songVideoClip.deleteMany({
      where: { songId, clipType: "OFFICIAL" },
    }),
    prisma.song.update({
      where: { id: songId },
      data: {
        musicVideoReleaseDate: null,
        youtubeReleaseDate: null,
      },
    }),
  ]);
  // Libera nova busca automática (tira flag de "já consultado").
  await clearManualReviewFlag(songId);

  return NextResponse.json({ ok: true, message: "Clipe e datas removidos" });
}
