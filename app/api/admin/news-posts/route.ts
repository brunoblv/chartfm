import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { auditNews, newsInputToData, newsRowToDto } from "@/lib/news-posts/server";
import { normalizeNewsInput } from "@/lib/news-posts/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await prisma.newsPost.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return NextResponse.json({ posts: rows.map(newsRowToDto) });
}

/** Cria um rascunho. Com `duplicateOf`, copia texto e foto de outro post (sem artes nem vídeo). */
export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  let raw: unknown = body;
  if (body && typeof body.duplicateOf === "string") {
    const src = await prisma.newsPost.findUnique({ where: { id: body.duplicateOf } });
    if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });
    raw = { ...newsRowToDto(src) };
  }

  const input = normalizeNewsInput(raw);
  if (!input) return NextResponse.json({ error: "invalid_format" }, { status: 400 });

  const row = await prisma.newsPost.create({
    data: {
      ...newsInputToData(input),
      title: input.title || "",
      createdById: auth.userId,
      updatedById: auth.userId,
    },
  });
  auditNews(auth.userId, "news_post.create", `Criou rascunho de notícia "${row.title || "(sem título)"}"`, row.id);
  return NextResponse.json({ post: newsRowToDto(row) }, { status: 201 });
}
