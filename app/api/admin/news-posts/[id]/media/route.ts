import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  NEWS_PHOTO_MAX_BYTES,
  NEWS_PHOTO_TYPES,
  NEWS_VIDEO_MAX_BYTES,
  NEWS_VIDEO_TYPES,
  removeNewsMedia,
  saveNewsMedia,
} from "@/lib/news-posts/media";
import { CLEAR_RENDER, discardRenderedFiles, newsRowToDto } from "@/lib/news-posts/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Envia a foto da matéria (post único / capa do carrossel) ou o vídeo (post com vídeo). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "PUBLISHED" || row.status === "PUBLISHING") return NextResponse.json({ error: "locked" }, { status: 409 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });

  const isVideo = row.format === "VIDEO";
  const types = isVideo ? NEWS_VIDEO_TYPES : NEWS_PHOTO_TYPES;
  const ext = types[file.type];
  if (!ext) return NextResponse.json({ error: isVideo ? "invalid_video_type" : "invalid_photo_type" }, { status: 400 });
  if (file.size > (isVideo ? NEWS_VIDEO_MAX_BYTES : NEWS_PHOTO_MAX_BYTES)) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const prefix = isVideo ? "source." : "photo.";
  await removeNewsMedia(id, prefix);
  const url = await saveNewsMedia(id, `${prefix}${ext}`, Buffer.from(await file.arrayBuffer()));

  const updated = await prisma.newsPost.update({
    where: { id },
    data: { ...(isVideo ? { videoUrl: url } : { photoUrl: url }), ...CLEAR_RENDER, updatedById: auth.userId },
  });
  await discardRenderedFiles(id);
  return NextResponse.json({ post: newsRowToDto(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const row = await prisma.newsPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "PUBLISHED" || row.status === "PUBLISHING") return NextResponse.json({ error: "locked" }, { status: 409 });

  const isVideo = row.format === "VIDEO";
  await removeNewsMedia(id, isVideo ? "source." : "photo.");
  const updated = await prisma.newsPost.update({
    where: { id },
    data: { ...(isVideo ? { videoUrl: null } : { photoUrl: null }), ...CLEAR_RENDER, updatedById: auth.userId },
  });
  await discardRenderedFiles(id);
  return NextResponse.json({ post: newsRowToDto(updated) });
}
