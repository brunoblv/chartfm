import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: chartId } = await context.params;

  const rows = await prisma.comment.findMany({
    where: { chartId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
        },
      },
    },
  });

  const comments = rows.map((c) => ({
    id: c.id,
    text: c.text,
    likes: c.likes,
    reactions: safeParseReactions(c.reactions),
    replyCount: c.replyCount,
    createdAt: c.createdAt.toISOString(),
    user: {
      id: c.user.id,
      handle: c.user.handle,
      name: c.user.name,
      avatarColor: c.user.avatarColor,
      image: c.user.image,
    },
  }));

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: chartId } = await context.params;

  const body = await req.json() as { text?: string };
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, userId: true, weekLabel: true },
  });
  if (!chart) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { chartId, userId: session.user.id, text },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            name: true,
            avatarColor: true,
            image: true,
          },
        },
      },
    }),
    prisma.chart.update({ where: { id: chartId }, data: { comments: { increment: 1 } } }),
  ]);

  await createNotification({
    recipientId: chart.userId,
    actorId: session.user.id,
    type: "comment",
    text: `comentou na sua parada ${chart.weekLabel}: "${text.length > 60 ? text.slice(0, 57) + "…" : text}"`,
    targetUrl: `/chart/${chartId}`,
  });

  return NextResponse.json({
    id: comment.id,
    text: comment.text,
    likes: comment.likes,
    reactions: [],
    replyCount: 0,
    createdAt: comment.createdAt.toISOString(),
    user: {
      id: comment.user.id,
      handle: comment.user.handle,
      name: comment.user.name,
      avatarColor: comment.user.avatarColor,
      image: comment.user.image,
    },
  }, { status: 201 });
}

function safeParseReactions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
