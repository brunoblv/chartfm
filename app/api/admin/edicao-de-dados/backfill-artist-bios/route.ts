import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { getWikipediaArtistBio } from "@/lib/wikipedia";
import { artistSemBioWhere } from "@/app/admin/dados/lib";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Backfill em lote das bios de artista via Wikipedia. Processa poucos por
 * chamada; o cliente repete até acabar, excluindo os IDs já tentados (não há
 * coluna de "não encontrado" para artista, então o cliente controla a fila).
 */

const MAX_BATCH_SIZE = 2;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    exclude?: unknown;
  };
  const limit = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH_SIZE),
  );
  const excludeIds = new Set(
    Array.isArray(body.exclude) ? body.exclude.filter((id): id is number => typeof id === "number") : [],
  );

  const where = excludeIds.size ? { AND: [artistSemBioWhere, { id: { notIn: [...excludeIds] } }] } : artistSemBioWhere;

  const artists = await prisma.artist.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  let updated = 0;
  const log: string[] = [];
  const notFound: { id: number; label: string; href: string }[] = [];

  for (const artist of artists) {
    try {
      const info = await getWikipediaArtistBio(artist.name);
      if (info) {
        await prisma.artist.update({ where: { id: artist.id }, data: { bio: info.bio } });
        updated += 1;
        log.push(`✓ ${artist.name}: bio (${info.lang})`);
      } else {
        notFound.push({ id: artist.id, label: artist.name, href: `/artist/${artist.id}/edit` });
        log.push(`— ${artist.name}: nada encontrado`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      notFound.push({ id: artist.id, label: artist.name, href: `/artist/${artist.id}/edit` });
      log.push(`✗ ${artist.name}: ${msg}`);
    }
  }

  const remaining = await prisma.artist.count({ where: artistSemBioWhere });

  return NextResponse.json({
    ok: true,
    processed: artists.length,
    updated,
    remaining,
    log,
    notFound,
  });
}
