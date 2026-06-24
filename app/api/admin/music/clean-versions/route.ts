import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { cleanRemasterTag } from "@/lib/clean-version-tag";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Candidate = {
  id: string;
  before: string;
  after: string;
  artist: string;
  entries: number;
  conflict: boolean;
};

/** Busca todas as músicas com tag de remaster e calcula o título limpo. */
async function buildCandidates(): Promise<Candidate[]> {
  const songs = await prisma.song.findMany({
    where: {
      OR: [
        { title: { contains: "remaster", mode: "insensitive" } },
        { title: { contains: "remastered", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      artistRef: { select: { name: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ artist: "asc" }, { title: "asc" }],
  });

  const changed = songs
    .map((s) => ({ s, after: cleanRemasterTag(s.title) }))
    .filter(({ s, after }) => after && after !== s.title);

  // Detecta colisões com o índice único (title, artist).
  // Há conflito se já existe outra música com o mesmo (after, artist),
  // ou se duas candidatas convergem para o mesmo (after, artist).
  const seen = new Map<string, string>(); // chave -> id da primeira candidata
  const candidates: Candidate[] = [];
  for (const { s, after } of changed) {
    const key = `${after.toLowerCase()}|||${s.artist.toLowerCase()}`;
    let conflict = false;

    const existing = await prisma.song.findFirst({
      where: { title: after, artist: s.artist, NOT: { id: s.id } },
      select: { id: true },
    });
    if (existing) conflict = true;

    if (seen.has(key)) conflict = true;
    else seen.set(key, s.id);

    candidates.push({
      id: s.id,
      before: s.title,
      after,
      artist: s.artistRef?.name ?? s.artist,
      entries: s._count.entries,
      conflict,
    });
  }

  return candidates;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { preview?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio = aplicar
  }

  const candidates = await buildCandidates();
  const applicable = candidates.filter((c) => !c.conflict);

  if (body.preview === true) {
    return NextResponse.json({
      preview: candidates,
      total: candidates.length,
      applicable: applicable.length,
      conflicts: candidates.length - applicable.length,
    });
  }

  let updated = 0;
  const skipped: { id: string; after: string; reason: string }[] = [];

  for (const c of applicable) {
    try {
      await prisma.song.update({
        where: { id: c.id },
        data: { title: c.after },
      });
      updated += 1;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        skipped.push({ id: c.id, after: c.after, reason: "unique_conflict" });
      } else {
        throw err;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    skippedConflicts: candidates.length - applicable.length + skipped.length,
  });
}
