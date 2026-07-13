import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: { params: Promise<{ postId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { postId } = await context.params;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });

  const body = (await req.json()) as { text?: string; replyToId?: string };
  const text = (body?.text ?? "").trim();
  const replyToId = typeof body?.replyToId === "string" ? body.replyToId.trim() : "";
  if (!text) return NextResponse.json({ error: "Escreva uma resposta." }, { status: 400 });
  if (text.length > 800) return NextResponse.json({ error: "Resposta muito longa (máx. 800 caracteres)." }, { status: 400 });

  if (replyToId) {
    const target = await prisma.postReply.findUnique({ where: { id: replyToId }, select: { id: true, postId: true } });
    if (!target || target.postId !== postId) {
      return NextResponse.json({ error: "Comentário original não encontrado." }, { status: 404 });
    }
  }

  const [reply] = await prisma.$transaction([
    prisma.postReply.create({
      data: {
        postId,
        userId: session.user.id,
        text,
        replyToId: replyToId || null,
      },
      include: {
        user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
        replyTo: { select: { id: true, user: { select: { handle: true, name: true } } } },
      },
    }),
    prisma.post.update({ where: { id: postId }, data: { replies: { increment: 1 } } }),
  ]);

  return NextResponse.json(
    {
      id: reply.id,
      text: reply.text,
      likes: reply.likes,
      hasLiked: false,
      replyToId: reply.replyToId,
      replyToUser: reply.replyTo
        ? { handle: reply.replyTo.user.handle, name: reply.replyTo.user.name }
        : null,
      createdAt: reply.createdAt.toISOString(),
      user: {
        id: reply.user.id,
        handle: reply.user.handle,
        name: reply.user.name,
        avatarColor: reply.user.avatarColor,
        image: reply.user.image,
      },
    },
    { status: 201 },
  );
}
