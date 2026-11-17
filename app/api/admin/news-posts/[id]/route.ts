import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { removeAllNewsMedia } from "@/lib/news-posts/media";
import {
  CLEAR_RENDER,
  auditNews,
  discardRenderedFiles,
  newsInputToData,
  newsRowFingerprint,
  newsRowToDto,
} from "@/lib/news-posts/server";
import { newsVisualFingerprint, normalizeNewsInput } from "@/lib/news-posts/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ post: newsRowToDto(row) });
}

/** Salva o rascunho. Se algo visual mudou, as artes geradas deixam de valer. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "PUBLISHED" || row.status === "PUBLISHING") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }

  const input = normalizeNewsInput({ ...(await req.json().catch(() => ({}))), format: row.format });
  if (!input) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const visualChanged =
    newsVisualFingerprint({ ...input, photoUrl: row.photoUrl, videoUrl: row.videoUrl }) !== newsRowFingerprint(row);

  const updated = await prisma.newsPost.update({
    where: { id },
    data: {
      ...newsInputToData(input),
      ...(visualChanged ? CLEAR_RENDER : {}),
      updatedById: auth.userId,
    },
  });
  if (visualChanged && row.renderedImages.length > 0) await discardRenderedFiles(id);

  return NextResponse.json({ post: newsRowToDto(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "PUBLISHING") return NextResponse.json({ error: "locked" }, { status: 409 });

  await prisma.newsPost.delete({ where: { id } });
  await removeAllNewsMedia(id);
  auditNews(auth.userId, "news_post.delete", `Excluiu a notícia "${row.title || "(sem título)"}"`, id);
  return NextResponse.json({ ok: true });
}
