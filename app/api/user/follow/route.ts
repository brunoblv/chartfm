import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { targetId?: string };
  const targetId = body?.targetId?.trim();

  if (!targetId || targetId === session.user.id) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: targetId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.userFollow.delete({
        where: { followerId_followingId: { followerId: session.user.id, followingId: targetId } },
      }),
      prisma.user.update({ where: { id: targetId }, data: { followers: { decrement: 1 } } }),
      prisma.user.update({ where: { id: session.user.id }, data: { following: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ following: false });
  }

  await prisma.$transaction([
    prisma.userFollow.create({ data: { followerId: session.user.id, followingId: targetId } }),
    prisma.user.update({ where: { id: targetId }, data: { followers: { increment: 1 } } }),
    prisma.user.update({ where: { id: session.user.id }, data: { following: { increment: 1 } } }),
  ]);

  await createNotification({
    recipientId: targetId,
    actorId: session.user.id,
    type: "follow",
    text: "começou a seguir você",
  });

  return NextResponse.json({ following: true });
}
