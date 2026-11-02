import { NextRequest, NextResponse } from "next/server";
import { brokenLinksMessage, checkRelatedLinks } from "@/lib/internal-link-check";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  getAllEditorialPostsForAdmin,
  normalizeEditorialPostInput,
  revalidateEditorialPaths,
  rowToEditorialPick,
  slugifyEditorialTitle,
  validateEditorialPostInput,
  type EditorialPostInput,
} from "@/lib/editorial-picks";

export const runtime = "nodejs";

function serializeAdminPost(row: Awaited<ReturnType<typeof getAllEditorialPostsForAdmin>>[number]) {
  const pick = rowToEditorialPick(row);
  return {
    id: row.id,
    ...pick,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await getAllEditorialPostsForAdmin();
  return NextResponse.json({ posts: rows.map(serializeAdminPost) });
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = (await req.json()) as Partial<EditorialPostInput>;
  const input = normalizeEditorialPostInput({
    ...raw,
    slug: raw.slug?.trim() || slugifyEditorialTitle(raw.title ?? ""),
  });

  const validationError = validateEditorialPostInput(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const linkCheck = await checkRelatedLinks(input.relatedLinks ?? []);
  if (input.published && linkCheck.broken.length > 0) {
    return NextResponse.json({ error: brokenLinksMessage(linkCheck.broken) }, { status: 400 });
  }
  input.relatedLinks = linkCheck.links;

  const existing = await prisma.editorialPost.findUnique({ where: { slug: input.slug } });
  if (existing) return NextResponse.json({ error: "Já existe um artigo com este slug." }, { status: 409 });

  const row = await prisma.editorialPost.create({
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
  return NextResponse.json({ post: serializeAdminPost(row) });
}
