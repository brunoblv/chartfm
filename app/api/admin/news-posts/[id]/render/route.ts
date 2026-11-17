import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { composeNewsVideo, newsMediaPathFromUrl, saveNewsMedia } from "@/lib/news-posts/media";
import { discardRenderedFiles, newsRowFingerprint, newsRowToDto } from "@/lib/news-posts/server";
import { newsSlideCount, validateNewsPost } from "@/lib/news-posts/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SLIDE_BYTES = 8 * 1024 * 1024;

/**
 * Recebe as artes 1080x1440 geradas no navegador (slide-0..N) e guarda.
 * Post com vídeo: a arte vira moldura e o servidor monta o MP4 final com ffmpeg.
 * `fingerprint` garante que a arte foi desenhada a partir do conteúdo salvo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "PUBLISHED" || row.status === "PUBLISHING") return NextResponse.json({ error: "locked" }, { status: 409 });

  const dto = newsRowToDto(row);
  if (validateNewsPost(dto).length > 0) return NextResponse.json({ error: "invalid_content" }, { status: 400 });
  if (row.format === "VIDEO" && !row.videoUrl) return NextResponse.json({ error: "missing_video" }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (form.get("fingerprint") !== newsRowFingerprint(row)) {
    return NextResponse.json({ error: "stale_content" }, { status: 409 });
  }

  const count = newsSlideCount(dto.format, dto.content);
  const buffers: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const file = form.get(`slide-${i}`);
    if (!(file instanceof File) || file.type !== "image/png" || file.size > MAX_SLIDE_BYTES) {
      return NextResponse.json({ error: "invalid_slides" }, { status: 400 });
    }
    buffers.push(Buffer.from(await file.arrayBuffer()));
  }

  await discardRenderedFiles(id);
  const urls: string[] = [];
  for (let i = 0; i < buffers.length; i++) urls.push(await saveNewsMedia(id, `slide-${i}.png`, buffers[i]));

  let renderedVideo: string | null = null;
  if (row.format === "VIDEO") {
    const card = newsMediaPathFromUrl(urls[0]);
    const source = newsMediaPathFromUrl(row.videoUrl);
    if (!card || !source) return NextResponse.json({ error: "missing_video" }, { status: 400 });
    try {
      renderedVideo = await composeNewsVideo(id, card, source);
    } catch (err) {
      console.error(`[news-posts/${id}] falha no ffmpeg`, err);
      return NextResponse.json({ error: "video_compose_failed" }, { status: 500 });
    }
  }

  const updated = await prisma.newsPost.update({
    where: { id },
    data: { renderedImages: urls, renderedVideo, renderedAt: new Date(), lastError: null },
  });
  return NextResponse.json({ post: newsRowToDto(updated) });
}
