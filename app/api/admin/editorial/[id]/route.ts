import { NextRequest, NextResponse } from "next/server";
import { brokenLinksMessage, checkRelatedLinks } from "@/lib/internal-link-check";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeEditorialPostInput,
  revalidateEditorialPaths,
  rowToEditorialPick,
  validateEditorialPostInput,
  type EditorialPostInput,
} from "@/lib/editorial-picks";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

function serializeAdminPost(
  row: NonNullable<Awaited<ReturnType<typeof prisma.editorialPost.findUnique>>>,
) {
  const pick = rowToEditorialPick(row);
  return {
    id: row.id,
    ...pick,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await prisma.editorialPost.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Artigo não encontrado." }, { status: 404 });

  return NextResponse.json({ post: serializeAdminPost(row) });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.editorialPost.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Artigo não encontrado." }, { status: 404 });

  const raw = (await req.json()) as Partial<EditorialPostInput>;
  const input = normalizeEditorialPostInput({
    slug: raw.slug ?? current.slug,
    title: raw.title ?? current.title,
    subtitle: raw.subtitle ?? current.subtitle,
    category: raw.category ?? (current.category as EditorialPostInput["category"]),
    publishedAt: raw.publishedAt ?? current.publishedAt.toISOString().slice(0, 10),
    author: raw.author ?? current.author,
    excerpt: raw.excerpt ?? current.excerpt,
    paragraphs: raw.paragraphs ?? (Array.isArray(current.paragraphs) ? (current.paragraphs as string[]) : []),
    youtubeUrl: raw.youtubeUrl ?? current.youtubeUrl,
    spotifyUrl: raw.spotifyUrl ?? current.spotifyUrl,
    previewImage: raw.previewImage ?? current.previewImage,
    tags: raw.tags ?? (Array.isArray(current.tags) ? (current.tags as string[]) : []),
    relatedLinks:
      raw.relatedLinks ??
      (Array.isArray(current.relatedLinks) ? (current.relatedLinks as { label: string; href: string }[]) : []),
    published: raw.published ?? current.published,
  });

  const validationError = validateEditorialPostInput(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const linkCheck = await checkRelatedLinks(input.relatedLinks ?? []);
  if (input.published && linkCheck.broken.length > 0) {
    return NextResponse.json({ error: brokenLinksMessage(linkCheck.broken) }, { status: 400 });
  }
  input.relatedLinks = linkCheck.links;

  if (input.slug !== current.slug) {
    const slugTaken = await prisma.editorialPost.findUnique({ where: { slug: input.slug } });
    if (slugTaken) return NextResponse.json({ error: "Já existe um artigo com este slug." }, { status: 409 });
  }

  const row = await prisma.editorialPost.update({
    where: { id },
    data: {
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle,
      category: input.category,
      publishedAt: new Date(input.publishedAt + "T12:00:00.000Z"),
      author: input.author,
      excerpt: input.excerpt,
      paragraphs: input.paragraphs,
      youtubeUrl: input.youtubeUrl,
      spotifyUrl: input.spotifyUrl,
      previewImage: input.previewImage,
      tags: input.tags,
      relatedLinks: input.relatedLinks,
      published: input.published,
    },
  });

  await revalidateEditorialPaths(row.slug);
  if (current.slug !== row.slug) await revalidateEditorialPaths(current.slug);

  return NextResponse.json({ post: serializeAdminPost(row) });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.editorialPost.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Artigo não encontrado." }, { status: 404 });

  await prisma.editorialPost.delete({ where: { id } });
  await revalidateEditorialPaths(current.slug);

  return NextResponse.json({ ok: true });
}
