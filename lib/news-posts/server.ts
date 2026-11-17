import type { NewsPost, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordSiteAudit } from "@/lib/site-audit-log";
import { removeNewsMedia } from "@/lib/news-posts/media";
import {
  newsVisualFingerprint,
  normalizeNewsContent,
  type NewsPostDTO,
  type NewsPostInput,
} from "@/lib/news-posts/types";

export function newsRowToDto(row: NewsPost): NewsPostDTO {
  return {
    id: row.id,
    format: row.format,
    status: row.status,
    theme: row.theme === "dark" ? "dark" : "light",
    eyebrow: row.eyebrow,
    title: row.title,
    summary: row.summary,
    newsDate: row.newsDate.toISOString().slice(0, 10),
    content: normalizeNewsContent(row.content),
    caption: row.caption,
    photoUrl: row.photoUrl,
    videoUrl: row.videoUrl,
    renderedImages: row.renderedImages,
    renderedVideo: row.renderedVideo,
    renderedAt: row.renderedAt?.toISOString() ?? null,
    instagramMediaId: row.instagramMediaId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function newsRowFingerprint(row: NewsPost): string {
  return newsVisualFingerprint(newsRowToDto(row));
}

export function newsInputToData(input: NewsPostInput) {
  return {
    format: input.format,
    theme: input.theme,
    eyebrow: input.eyebrow,
    title: input.title,
    summary: input.summary,
    newsDate: new Date(`${input.newsDate}T12:00:00.000Z`),
    content: input.content as unknown as Prisma.InputJsonValue,
    caption: input.caption,
  };
}

/** Patch que descarta artes geradas — usar sempre que algo visual mudar. */
export const CLEAR_RENDER: Prisma.NewsPostUpdateInput = { renderedImages: [], renderedVideo: null, renderedAt: null };

export async function discardRenderedFiles(postId: string): Promise<void> {
  await Promise.all([removeNewsMedia(postId, "slide-"), removeNewsMedia(postId, "final.")]);
}

export async function loadNewsPost(id: string): Promise<NewsPost | null> {
  return prisma.newsPost.findUnique({ where: { id } });
}

export function auditNews(userId: string, action: string, summary: string, postId: string): void {
  void recordSiteAudit({ action, summary, userId, entityType: "news_post", entityId: postId });
}
