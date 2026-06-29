import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { recommendationDisplayTitle } from "@/lib/recommendations-feed";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: recommendationId } = await context.params;
  const session = await getServerSession(authOptions);

  const rows = await prisma.songRecommendationComment.findMany({
    where: { recommendationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: { id: true, handle: true, name: true, avatarColor: true, image: true },
      },
    },
  });

  const likedIds = new Set<string>();
  if (session?.user?.id && rows.length > 0) {
    const likes = await prisma.songRecommendationCommentLike.findMany({
      where: {
        userId: session.user.id,
        commentId: { in: rows.map((r) => r.id) },
      },
      select: { commentId: true },
    });
    for (const like of likes) likedIds.add(like.commentId);
  }

  return NextResponse.json(
    rows.map((c) => ({
      id: c.id,
      text: c.text,
      likes: c.likes,
      liked: likedIds.has(c.id),
      replyCount: c.replyCount,
      createdAt: c.createdAt.toISOString(),
      user: {
        id: c.user.id,
        handle: c.user.handle,
        name: c.user.name,
        avatarColor: c.user.avatarColor,
        image: c.user.image,
      },
    })),
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: recommendationId } = await context.params;
  const body = (await req.json()) as { text?: string };
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const rec = await prisma.songRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      id: true,
      userId: true,
      youtubeId: true,
      ytTitle: true,
      song: { select: { title: true, exhibitionName: true } },
    },
  });
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [comment] = await prisma.$transaction([
    prisma.songRecommendationComment.create({
      data: { recommendationId, userId: session.user.id, text },
      include: {
        user: {
          select: { id: true, handle: true, name: true, avatarColor: true, image: true },
        },
      },
    }),
    prisma.songRecommendation.update({
      where: { id: recommendationId },
      data: { comments: { increment: 1 } },
    }),
  ]);

  if (rec.userId !== session.user.id) {
    const title = recommendationDisplayTitle(rec);
    await createNotification({
      recipientId: rec.userId,
      actorId: session.user.id,
      type: "comment",
      text: `comentou na sua recomendação de "${title}": "${text.length > 60 ? text.slice(0, 57) + "…" : text}"`,
      targetUrl: "/",
    });
  }

  return NextResponse.json(
    {
      id: comment.id,
      text: comment.text,
      likes: comment.likes,
      liked: false,
      replyCount: 0,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        handle: comment.user.handle,
        name: comment.user.name,
        avatarColor: comment.user.avatarColor,
        image: comment.user.image,
      },
    },
    { status: 201 },
  );
}
