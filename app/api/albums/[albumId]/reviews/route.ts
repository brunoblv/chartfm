import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId: rawId } = await params;
  const albumId = parseInt(rawId, 10);
  if (isNaN(albumId)) return NextResponse.json({ error: "Invalid albumId" }, { status: 400 });

  const reviews = await prisma.albumReview.findMany({
    where: { albumId },
    orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      rating: true,
      body: true,
      helpful: true,
      createdAt: true,
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
    },
  });

  return NextResponse.json(reviews);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { albumId: rawId } = await params;
  const albumId = parseInt(rawId, 10);
  if (isNaN(albumId)) return NextResponse.json({ error: "Invalid albumId" }, { status: 400 });

  const body = await req.json();
  const { rating, reviewBody } = body as { rating: number; reviewBody?: string };

  if (typeof rating !== "number" || rating < 0 || rating > 100)
    return NextResponse.json({ error: "Rating must be 0–100" }, { status: 400 });
  if (reviewBody && reviewBody.trim().length > 0 && reviewBody.trim().length < 50)
    return NextResponse.json({ error: "Review too short (min 50 chars)" }, { status: 400 });

  const review = await prisma.albumReview.upsert({
    where: { albumId_userId: { albumId, userId: session.user.id } },
    create: { albumId, userId: session.user.id, rating, body: reviewBody?.trim() || null },
    update: { rating, body: reviewBody?.trim() || null },
    select: { id: true, rating: true, body: true, helpful: true, createdAt: true },
  });

  return NextResponse.json(review);
}
