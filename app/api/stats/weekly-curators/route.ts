import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export async function GET() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await prisma.chart.groupBy({
    by: ["userId"],
    where: { publishedAt: { gte: since } },
  });
  return NextResponse.json({ count: count.length });
}
