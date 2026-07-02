import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { parseParadaCommentScope } from "@/lib/parada-comments";

export const runtime = "nodejs";

const userSelect = {
  id: true,
  handle: true,
  name: true,
  avatarColor: true,
  image: true,
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = parseParadaCommentScope({
    communityId: searchParams.get("communityId"),
    genreSlug: searchParams.get("genreSlug"),
    section: searchParams.get("section"),
    period: searchParams.get("period"),
    weekIndex: searchParams.get("weekIndex"),
  });
  if (!scope) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });

  const session = await getServerSession(authOptions);

  const rows = await prisma.paradaComment.findMany({
    where: {
      communityId: scope.communityId,
      genreSlug: scope.genreSlug,
      section: scope.section,
      period: scope.period,
      weekIndex: scope.weekIndex,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: userSelect } },
  });

  const likedIds = new Set<string>();
  if (session?.user?.id && rows.length > 0) {
    const likes = await prisma.paradaCommentLike.findMany({
      where: { userId: session.user.id, paradaCommentId: { in: rows.map((r) => r.id) } },
      select: { paradaCommentId: true },
    });
    for (const like of likes) likedIds.add(like.paradaCommentId);
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    text?: string;
    communityId?: string | null;
    genreSlug?: string | null;
    section?: string;
    period?: string;
    weekIndex?: number;
  };

  const scope = parseParadaCommentScope(body);
  if (!scope) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });

  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "too_long" }, { status: 400 });

  if (scope.communityId) {
    const community = await prisma.community.findUnique({
      where: { id: scope.communityId },
      select: { id: true },
    });
    if (!community) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const comment = await prisma.paradaComment.create({
    data: {
      communityId: scope.communityId,
      genreSlug: scope.genreSlug,
      section: scope.section,
      period: scope.period,
      weekIndex: scope.weekIndex,
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
