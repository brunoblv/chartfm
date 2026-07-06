import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string; commentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { commentId } = await context.params;

  const comment = await prisma.copaLiveComment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.copaLiveCommentLike.findUnique({
    where: { commentId_userId: { commentId, userId: session.user.id } },
    select: { id: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.copaLiveCommentLike.delete({
        where: { commentId_userId: { commentId, userId: session.user.id } },
      }),
      prisma.copaLiveComment.update({
        where: { id: commentId },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      }),
    ]);
    return NextResponse.json({ liked: false, likes: updated.likes });
  }

  const [, updated] = await prisma.$transaction([
    prisma.copaLiveCommentLike.create({ data: { commentId, userId: session.user.id } }),
    prisma.copaLiveComment.update({
      where: { id: commentId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    }),
  ]);

  return NextResponse.json({ liked: true, likes: updated.likes });
}
