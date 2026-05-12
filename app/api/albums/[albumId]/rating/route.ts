import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ rating: null });

  const { albumId: rawId } = await params;
  const albumId = parseInt(rawId, 10);
  if (isNaN(albumId)) return NextResponse.json({ rating: null });

  const review = await prisma.albumReview.findUnique({
    where: { albumId_userId: { albumId, userId: session.user.id } },
    select: { rating: true },
  });
  return NextResponse.json({ rating: review?.rating ?? null });
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
  const { rating } = body as { rating: number };
  if (typeof rating !== "number" || rating < 0 || rating > 100)
    return NextResponse.json({ error: "Rating must be 0–100" }, { status: 400 });

  await prisma.albumReview.upsert({
    where: { albumId_userId: { albumId, userId: session.user.id } },
    create: { albumId, userId: session.user.id, rating },
    update: { rating },
  });
  return NextResponse.json({ rating });
}
