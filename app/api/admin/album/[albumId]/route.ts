import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ albumId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { albumId } = await context.params;
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_album_id" }, { status: 400 });

  const album = await prisma.album.findUnique({
    where: { id },
    select: { id: true, title: true, exhibitionName: true, coverUrl: true, spotifyId: true },
  });
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ album });
}

type PatchBody = { title?: unknown; romanization?: unknown; coverUrl?: unknown };

export async function PATCH(req: NextRequest, context: { params: Promise<{ albumId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { albumId } = await context.params;
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_album_id" }, { status: 400 });

  const body = (await req.json()) as PatchBody;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";
  const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() : "";
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  const existing = await prisma.album.findUnique({ where: { id }, select: { spotifyId: true } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const album = await prisma.album.update({
    where: { id },
    data: { title, exhibitionName: romanization || null, coverUrl: coverUrl || null },
    select: { id: true, title: true, exhibitionName: true, coverUrl: true, spotifyId: true },
  });

  await prisma.song.updateMany({
    where: { albumSpotifyId: existing.spotifyId },
    data: { album: title, ...(coverUrl ? { coverImageUrl: coverUrl } : {}) },
  });

  return NextResponse.json({ album });
}
