import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { songId } = await params;
  const userId = session.user.id;

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }

  const existing = await prisma.songFlag.findFirst({
    where: { songId, userId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyFlagged: true });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  await prisma.songFlag.create({
    data: { songId, userId, reason: reason || null },
  });

  return NextResponse.json({ ok: true, alreadyFlagged: false });
}
