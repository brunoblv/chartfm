import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: chartId, commentId } = await context.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      chartId: true,
      userId: true,
      chart: { select: { userId: true } },
    },
  });

  if (!comment || comment.chartId !== chartId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isAuthor = comment.userId === session.user.id;
  const isChartOwner = comment.chart.userId === session.user.id;
  if (!isAuthor && !isChartOwner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.chart.updateMany({
      where: { id: chartId, comments: { gt: 0 } },
      data: { comments: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
