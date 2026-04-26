import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const rankingWeek = getRankingWeekReference(new Date());

  const updatedRows = await prisma.$executeRaw`
    UPDATE "ChartEntry" ce
    SET "points" = 101 - ce."position"
    FROM "Chart" c
    WHERE ce."chartId" = c."id"
      AND c."weekIndex" = ${rankingWeek.weekIndex}
      AND ce."points" IS DISTINCT FROM (101 - ce."position")
  `;

  return NextResponse.json({
    ok: true,
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    updatedRows,
  });
}
