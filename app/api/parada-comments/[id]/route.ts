import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const comment = await prisma.paradaComment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (comment.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.paradaComment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
