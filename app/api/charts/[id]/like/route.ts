import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: chartId } = await context.params;

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, userId: true, weekLabel: true },
  });
  if (!chart) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.chartLike.findUnique({
    where: { userId_chartId: { userId: session.user.id, chartId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.chartLike.delete({ where: { userId_chartId: { userId: session.user.id, chartId } } }),
      prisma.chart.update({ where: { id: chartId }, data: { likes: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ liked: false });
  }

  const [, updated] = await prisma.$transaction([
    prisma.chartLike.create({ data: { userId: session.user.id, chartId } }),
    prisma.chart.update({ where: { id: chartId }, data: { likes: { increment: 1 } }, select: { likes: true } }),
  ]);

  await createNotification({
    recipientId: chart.userId,
    actorId: session.user.id,
    type: "like",
    text: `curtiu sua parada ${chart.weekLabel}`,
    targetUrl: `/chart/${chartId}`,
  });

  return NextResponse.json({ liked: true, likes: updated.likes });
}
