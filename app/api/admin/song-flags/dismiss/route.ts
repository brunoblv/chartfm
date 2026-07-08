import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const songId = typeof body?.songId === "string" ? body.songId.trim() : "";
  if (!songId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await prisma.songFlag.updateMany({
    where: { songId, status: "PENDING" },
    data: { status: "DISMISSED" },
  });

  return NextResponse.json({ ok: true });
}
