import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, context: { params: Promise<{ replyId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { replyId } = await context.params;
  const userId = session.user.id;

  const reply = await prisma.postReply.findUnique({ where: { id: replyId }, select: { id: true } });
  if (!reply) return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });

  const existing = await prisma.postReplyLike.findUnique({
    where: { userId_replyId: { userId, replyId } },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.postReplyLike.delete({ where: { id: existing.id } }),
      prisma.postReply.update({ where: { id: replyId }, data: { likes: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ liked: false, likes: updated.likes });
  }

  const [, updated] = await prisma.$transaction([
    prisma.postReplyLike.create({ data: { userId, replyId } }),
    prisma.postReply.update({ where: { id: replyId }, data: { likes: { increment: 1 } } }),
  ]);
  return NextResponse.json({ liked: true, likes: updated.likes });
}
