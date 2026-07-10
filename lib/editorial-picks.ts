import type { EditorialPost } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EDITORIAL_PICKS,
  type EditorialPick,
  type EditorialPickCategory,
} from "@/lib/editorial-picks-data";

export const EDITORIAL_POSTS_TAG = "editorial-posts";

type RelatedLink = { label: string; href: string };

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function formatPublishedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function rowToEditorialPick(row: EditorialPost): EditorialPick {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    category: row.category as EditorialPickCategory,
    publishedAt: formatPublishedAt(row.publishedAt),
    author: row.author,
    excerpt: row.excerpt,
    paragraphs: parseJsonArray<string>(row.paragraphs),
    youtubeUrl: row.youtubeUrl ?? undefined,
    spotifyUrl: row.spotifyUrl ?? undefined,
    previewImage: row.previewImage ?? undefined,
    tags: parseJsonArray<string>(row.tags),
    relatedLinks: parseJsonArray<RelatedLink>(row.relatedLinks),
  };
}

export async function seedEditorialPostsIfEmpty(): Promise<void> {
  const count = await prisma.editorialPost.count();
  if (count > 0) return;

  await prisma.editorialPost.createMany({
    data: EDITORIAL_PICKS.map((pick) => ({
      slug: pick.slug,
      title: pick.title,
      subtitle: pick.subtitle ?? null,
      category: pick.category,
      publishedAt: new Date(pick.publishedAt + "T12:00:00.000Z"),
      author: pick.author,
      excerpt: pick.excerpt,
      paragraphs: pick.paragraphs,
      youtubeUrl: pick.youtubeUrl ?? null,
      spotifyUrl: pick.spotifyUrl ?? null,
      previewImage: pick.previewImage ?? null,
      tags: pick.tags ?? [],
      relatedLinks: pick.relatedLinks ?? [],
      published: true,
    })),
    skipDuplicates: true,
  });
}

export async function getEditorialPicksSorted(): Promise<EditorialPick[]> {
  await seedEditorialPostsIfEmpty();
  const rows = await prisma.editorialPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(rowToEditorialPick);
}

export async function getEditorialPick(slug: string): Promise<EditorialPick | null> {
  await seedEditorialPostsIfEmpty();
  const row = await prisma.editorialPost.findFirst({
    where: { slug, published: true },
  });
  return row ? rowToEditorialPick(row) : null;
}

export async function getAllEditorialPostsForAdmin() {
  await seedEditorialPostsIfEmpty();
  return prisma.editorialPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export function slugifyEditorialTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type EditorialPostInput = {
  slug: string;
  title: string;
  subtitle?: string | null;
  category: EditorialPickCategory;
  publishedAt: string;
  author: string;
  excerpt: string;
  paragraphs: string[];
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  previewImage?: string | null;
  tags?: string[];
  relatedLinks?: RelatedLink[];
  published?: boolean;
};

export function validateEditorialPostInput(body: Partial<EditorialPostInput>): string | null {
  if (!body.title?.trim()) return "Título é obrigatório.";
  if (!body.slug?.trim()) return "Slug é obrigatório.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug.trim())) {
    return "Slug inválido - use apenas letras minúsculas, números e hífens.";
  }
  if (!body.excerpt?.trim()) return "Resumo (excerpt) é obrigatório.";
  if (!body.paragraphs?.length || !body.paragraphs.some((p) => p.trim())) {
    return "Adicione pelo menos um parágrafo.";
  }
  if (!body.publishedAt || Number.isNaN(Date.parse(body.publishedAt))) {
    return "Data de publicação inválida.";
  }
  const validCategories: EditorialPickCategory[] = [
    "video",
    "clipe",
    "playlist",
    "album",
    "artista",
    "editorial",
  ];
  if (!body.category || !validCategories.includes(body.category)) {
    return "Categoria inválida.";
  }
  return null;
}

export function normalizeEditorialPostInput(body: Partial<EditorialPostInput>): EditorialPostInput {
  return {
    slug: body.slug!.trim(),
    title: body.title!.trim(),
    subtitle: body.subtitle?.trim() || null,
    category: body.category!,
    publishedAt: body.publishedAt!,
    author: body.author?.trim() || "Equipe ChartFM",
    excerpt: body.excerpt!.trim(),
    paragraphs: (body.paragraphs ?? []).map((p) => p.trim()).filter(Boolean),
    youtubeUrl: body.youtubeUrl?.trim() || null,
    spotifyUrl: body.spotifyUrl?.trim() || null,
    previewImage: body.previewImage?.trim() || null,
    tags: (body.tags ?? []).map((t) => t.trim()).filter(Boolean),
    relatedLinks: (body.relatedLinks ?? []).filter((l) => l.label.trim() && l.href.trim()),
    published: body.published !== false,
  };
}

export async function revalidateEditorialPaths(slug?: string) {
  const { revalidatePath, revalidateTag } = await import("next/cache");
  revalidateTag(EDITORIAL_POSTS_TAG, "max");
  revalidatePath("/editorial");
  if (slug) revalidatePath(`/editorial/${slug}`);
}
