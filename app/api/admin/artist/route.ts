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

type PostBody = { name?: unknown; spotifyId?: unknown; romanization?: unknown; imageUrl?: unknown };

export async function POST(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const body = (await req.json()) as PostBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const spotifyId = typeof body.spotifyId === "string" ? body.spotifyId.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!spotifyId) return NextResponse.json({ error: "spotify_id_required" }, { status: 400 });

  try {
    const artist = await prisma.artist.create({
      data: { name, spotifyId, exhibitionName: romanization || null, imageUrl: imageUrl || null },
      select: { id: true, name: true, exhibitionName: true, imageUrl: true, spotifyId: true },
    });
    return NextResponse.json({ artist }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "spotify_id_already_exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
