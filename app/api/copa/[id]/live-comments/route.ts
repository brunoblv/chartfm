import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const userSelect = {
  id: true,
  handle: true,
  name: true,
  avatarColor: true,
  image: true,
} as const;

function parseBatchOrder(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: copaId } = await context.params;
  const { searchParams } = new URL(req.url);
  const batchOrder = parseBatchOrder(searchParams.get("batchOrder"));

  const session = await getServerSession(authOptions);

  const rows = await prisma.copaLiveComment.findMany({
    where: { copaId, batchOrder },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: userSelect } },
  });

  const likedIds = new Set<string>();
  if (session?.user?.id && rows.length > 0) {
    const likes = await prisma.copaLiveCommentLike.findMany({
      where: { userId: session.user.id, commentId: { in: rows.map((r) => r.id) } },
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
      createdAt: c.createdAt.toISOString(),
      user: c.user,
    })),
  );
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: copaId } = await context.params;
  const body = (await req.json()) as { text?: string; batchOrder?: number | null };

  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const batchOrder =
    body.batchOrder == null || body.batchOrder === undefined ? null : Number(body.batchOrder);
  if (batchOrder != null && !Number.isFinite(batchOrder)) {
    return NextResponse.json({ error: "invalid_batch" }, { status: 400 });
  }

  const copa = await prisma.copaEdition.findUnique({ where: { id: copaId }, select: { id: true } });
  if (!copa) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const comment = await prisma.copaLiveComment.create({
    data: {
      copaId,
      batchOrder,
      userId: session.user.id,
      text,
    },
    include: { user: { select: userSelect } },
  });

  return NextResponse.json(
    {
      id: comment.id,
      text: comment.text,
      likes: comment.likes,
      liked: false,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
    },
    { status: 201 },
  );
}
