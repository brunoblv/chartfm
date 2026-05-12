import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; reviewId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { reviewId } = await params;

  const review = await prisma.albumReview.findUnique({ where: { id: reviewId } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (review.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.albumReview.delete({ where: { id: reviewId } });
  return NextResponse.json({ ok: true });
}
