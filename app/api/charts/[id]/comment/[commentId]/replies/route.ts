import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { commentId } = await context.params;

  const rows = await prisma.commentReply.findMany({
    where: { commentId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      user: {
        select: { id: true, handle: true, name: true, avatarColor: true, image: true },
      },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      text: r.text,
      likes: r.likes,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user.id,
        handle: r.user.handle,
        name: r.user.name,
        avatarColor: r.user.avatarColor,
        image: r.user.image,
      },
    })),
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: chartId, commentId } = await context.params;

  const body = (await req.json()) as { text?: string };
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 800) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, chartId: true },
  });
  if (!comment || comment.chartId !== chartId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [reply] = await prisma.$transaction([
    prisma.commentReply.create({
      data: { commentId, userId: session.user.id, text },
      include: {
        user: {
          select: { id: true, handle: true, name: true, avatarColor: true, image: true },
        },
      },
    }),
    prisma.comment.update({ where: { id: commentId }, data: { replyCount: { increment: 1 } } }),
  ]);

  await createNotification({
    recipientId: comment.userId,
    actorId: session.user.id,
    type: "comment_reply",
    text: `respondeu ao seu comentário: "${text.length > 60 ? text.slice(0, 57) + "…" : text}"`,
    targetUrl: `/chart/${chartId}`,
  });

  return NextResponse.json(
    {
      id: reply.id,
      text: reply.text,
      likes: reply.likes,
      createdAt: reply.createdAt.toISOString(),
      user: {
        id: reply.user.id,
        handle: reply.user.handle,
        name: reply.user.name,
        avatarColor: reply.user.avatarColor,
        image: reply.user.image,
      },
    },
    { status: 201 },
  );
}
