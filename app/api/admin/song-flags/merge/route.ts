import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { mergeSongs } from "@/lib/song-merge";
import { refreshSnapshotsForSong } from "@/lib/entity-page-snapshot/refresh-song";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const songId = typeof body?.songId === "string" ? body.songId.trim() : "";
  const keepId = typeof body?.keepId === "string" ? body.keepId.trim() : "";
  if (!songId || !keepId || songId === keepId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await mergeSongs(keepId, songId);
  void refreshSnapshotsForSong(keepId);

  return NextResponse.json({ ok: true });
}
