import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { OR: [{ actorId: userId }, { recipientId: userId }] },
    }),
    prisma.postReply.deleteMany({ where: { userId } }),
    prisma.postLike.deleteMany({ where: { userId } }),
    prisma.communityMember.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.chartRepost.deleteMany({ where: { userId } }),
    prisma.chartLike.deleteMany({ where: { userId } }),
    prisma.post.deleteMany({ where: { userId } }),
    prisma.chart.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
