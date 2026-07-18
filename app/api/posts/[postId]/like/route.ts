import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, context: { params: Promise<{ postId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { postId } = await context.params;
  const userId = session.user.id;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });

  const existing = await prisma.postLike.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.postLike.delete({ where: { id: existing.id } }),
      prisma.post.update({ where: { id: postId }, data: { likes: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ liked: false, likes: Math.max(0, updated.likes) });
  }

  const [, updated] = await prisma.$transaction([
    prisma.postLike.create({ data: { userId, postId } }),
    prisma.post.update({ where: { id: postId }, data: { likes: { increment: 1 } } }),
  ]);
  return NextResponse.json({ liked: true, likes: updated.likes });
}
