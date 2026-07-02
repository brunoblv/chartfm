import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: paradaCommentId } = await context.params;

  const comment = await prisma.paradaComment.findUnique({
    where: { id: paradaCommentId },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.paradaCommentLike.findUnique({
    where: { paradaCommentId_userId: { paradaCommentId, userId: session.user.id } },
    select: { id: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.paradaCommentLike.delete({
        where: { paradaCommentId_userId: { paradaCommentId, userId: session.user.id } },
      }),
      prisma.paradaComment.update({
        where: { id: paradaCommentId },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      }),
    ]);
    return NextResponse.json({ liked: false, likes: updated.likes });
  }

  const [, updated] = await prisma.$transaction([
    prisma.paradaCommentLike.create({ data: { paradaCommentId, userId: session.user.id } }),
    prisma.paradaComment.update({
      where: { id: paradaCommentId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    }),
  ]);

  return NextResponse.json({ liked: true, likes: updated.likes });
}
