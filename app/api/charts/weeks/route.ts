import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const paradaId = url.searchParams.get("paradaId")?.trim() || undefined;

  const charts = await prisma.chart.findMany({
    where: {
      userId: session.user.id,
      ...(paradaId ? { paradaId } : {}),
    },
    select: { weekIndex: true },
    orderBy: { weekIndex: "asc" },
  });

  return NextResponse.json({ weekIndexes: charts.map((c) => c.weekIndex) });
}
