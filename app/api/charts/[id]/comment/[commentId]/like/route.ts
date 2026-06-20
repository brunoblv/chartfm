import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: chartId, commentId } = await context.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, chartId: true, text: true },
  });
  if (!comment || comment.chartId !== chartId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId: session.user.id, commentId } },
    select: { id: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.commentLike.delete({
        where: { userId_commentId: { userId: session.user.id, commentId } },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      }),
    ]);
    return NextResponse.json({ liked: false, likes: updated.likes });
  }

  const [, updated] = await prisma.$transaction([
    prisma.commentLike.create({ data: { userId: session.user.id, commentId } }),
    prisma.comment.update({
      where: { id: commentId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    }),
  ]);

  const preview =
    comment.text.length > 60 ? `${comment.text.slice(0, 57)}…` : comment.text;

  await createNotification({
    recipientId: comment.userId,
    actorId: session.user.id,
    type: "comment_like",
    text: `curtiu seu comentário: "${preview}"`,
    targetUrl: `/chart/${chartId}`,
  });

  return NextResponse.json({ liked: true, likes: updated.likes });
}
