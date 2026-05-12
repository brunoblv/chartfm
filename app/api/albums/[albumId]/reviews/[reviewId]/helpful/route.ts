import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; reviewId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { reviewId } = await params;

  const existing = await prisma.albumReviewHelpful.findUnique({
    where: { reviewId_userId: { reviewId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.albumReviewHelpful.delete({ where: { id: existing.id } }),
      prisma.albumReview.update({ where: { id: reviewId }, data: { helpful: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ helpful: false });
  }

  await prisma.$transaction([
    prisma.albumReviewHelpful.create({ data: { reviewId, userId: session.user.id } }),
    prisma.albumReview.update({ where: { id: reviewId }, data: { helpful: { increment: 1 } } }),
  ]);
  return NextResponse.json({ helpful: true });
}
