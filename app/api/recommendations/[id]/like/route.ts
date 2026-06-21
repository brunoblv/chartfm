import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: recommendationId } = await context.params;

  const rec = await prisma.songRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      id: true,
      userId: true,
      song: { select: { title: true, exhibitionName: true } },
    },
  });
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.songRecommendationLike.findUnique({
    where: {
      userId_recommendationId: { userId: session.user.id, recommendationId },
    },
    select: { id: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.songRecommendationLike.delete({
        where: { userId_recommendationId: { userId: session.user.id, recommendationId } },
      }),
      prisma.songRecommendation.update({
        where: { id: recommendationId },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      }),
    ]);
    return NextResponse.json({ liked: false, likes: updated.likes });
  }

  const [, updated] = await prisma.$transaction([
    prisma.songRecommendationLike.create({
      data: { userId: session.user.id, recommendationId },
    }),
    prisma.songRecommendation.update({
      where: { id: recommendationId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    }),
  ]);

  if (rec.userId !== session.user.id) {
    const title = rec.song.exhibitionName?.trim() || rec.song.title;
    await createNotification({
      recipientId: rec.userId,
      actorId: session.user.id,
      type: "like",
      text: `curtiu sua recomendação de "${title}"`,
      targetUrl: "/",
    });
  }

  return NextResponse.json({ liked: true, likes: updated.likes });
}
