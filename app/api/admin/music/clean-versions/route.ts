import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import {
  cleanVersionTag,
  VERSION_TAG_CLEANERS,
  type VersionTagType,
} from "@/lib/clean-version-tag";
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

function parseTagType(raw: unknown): VersionTagType | null {
  if (typeof raw !== "string") return null;
  return raw in VERSION_TAG_CLEANERS ? (raw as VersionTagType) : null;
}

/** Busca músicas com tag do tipo indicado e calcula o título limpo. */
async function buildCandidates(type: VersionTagType): Promise<Candidate[]> {
  const { searchTerms } = VERSION_TAG_CLEANERS[type];
  const songs = await prisma.song.findMany({
    where: {
      OR: searchTerms.map((term) => ({
        title: { contains: term, mode: "insensitive" as const },
      })),
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
    .map((s) => ({ s, after: cleanVersionTag(s.title, type) }))
    .filter(({ s, after }) => after && after !== s.title);

  const seen = new Map<string, string>();
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

  let body: { preview?: unknown; type?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio = aplicar
  }

  const type = parseTagType(body.type) ?? "remaster";
  const candidates = await buildCandidates(type);
  const applicable = candidates.filter((c) => !c.conflict);

  if (body.preview === true) {
    return NextResponse.json({
      preview: candidates,
      total: candidates.length,
      applicable: applicable.length,
      conflicts: candidates.length - applicable.length,
      type,
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
    type,
  });
}
