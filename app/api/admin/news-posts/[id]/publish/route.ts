import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { absoluteSocialUrl } from "@/lib/social/config";
import { publishNewsCarousel, publishNewsImage, publishNewsReel } from "@/lib/social/publish/instagram-news";
import type { PublishResult } from "@/lib/social/publish/shared";
import { auditNews, newsRowToDto } from "@/lib/news-posts/server";
import { newsSlideCount, validateNewsPost } from "@/lib/news-posts/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Publica no Instagram as artes já geradas. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const dto = newsRowToDto(row);
  if (validateNewsPost(dto).length > 0) return NextResponse.json({ error: "invalid_content" }, { status: 400 });
  if (!dto.caption.trim()) return NextResponse.json({ error: "missing_caption" }, { status: 400 });
  const expected = newsSlideCount(dto.format, dto.content);
  if (row.renderedImages.length !== expected || (row.format === "VIDEO" && !row.renderedVideo)) {
    return NextResponse.json({ error: "not_rendered" }, { status: 400 });
  }

  // Trava contra clique duplo / duas abas: só um request passa de DRAFT|FAILED para PUBLISHING.
  const lock = await prisma.newsPost.updateMany({
    where: { id, status: { in: ["DRAFT", "FAILED"] } },
    data: { status: "PUBLISHING", lastError: null },
  });
  if (lock.count === 0) return NextResponse.json({ error: "locked" }, { status: 409 });

  const images = row.renderedImages.map(absoluteSocialUrl);
  let result: PublishResult;
  try {
    if (row.format === "CAROUSEL") result = await publishNewsCarousel(row.caption, images);
    else if (row.format === "VIDEO") result = await publishNewsReel(row.caption, absoluteSocialUrl(row.renderedVideo!), images[0]);
    else result = await publishNewsImage(row.caption, images[0]);
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  const updated = await prisma.newsPost.update({
    where: { id },
    data: result.ok
      ? { status: "PUBLISHED", publishedAt: new Date(), instagramMediaId: result.externalId ?? null, lastError: null }
      : { status: "FAILED", lastError: result.error ?? "Erro desconhecido" },
  });

  auditNews(
    auth.userId,
    result.ok ? "news_post.publish" : "news_post.publish_failed",
    result.ok
      ? `Publicou no Instagram a notícia "${row.title}"`
      : `Falha ao publicar no Instagram a notícia "${row.title}": ${result.error ?? ""}`,
    id,
  );

  return NextResponse.json({ post: newsRowToDto(updated) }, { status: result.ok ? 200 : 502 });
}
