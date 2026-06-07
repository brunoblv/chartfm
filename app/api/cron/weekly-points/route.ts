import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";

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
    SET "points" = CASE
      WHEN p."is_primary" THEN 101 - ce."position"
      WHEN cnt.n <= 1 THEN 10
      ELSE GREATEST(1, ROUND(
        10.0 - (ce."position" - 1.0) * 9.0 / (cnt.n - 1.0)
      ))
    END
    FROM "Chart" c
    INNER JOIN "paradas" p ON p."id" = c."parada_id"
    INNER JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM "ChartEntry" ce2 WHERE ce2."chartId" = c."id"
    ) cnt ON true
    WHERE ce."chartId" = c."id"
      AND c."weekIndex" = ${rankingWeek.weekIndex}
      AND ce."points" IS DISTINCT FROM (
        CASE
          WHEN p."is_primary" THEN 101 - ce."position"
          WHEN cnt.n <= 1 THEN 10
          ELSE GREATEST(1, ROUND(
            10.0 - (ce."position" - 1.0) * 9.0 / (cnt.n - 1.0)
          ))
        END
      )
  `;
  const snapshot = await getOrCreateRankingWeekSnapshot(new Date());

  let notificationsSent = 0;
  if (snapshot.created) {
    const targetUrl = `/global`;
    const existingCount = await prisma.notification.count({
      where: {
        type: "global_chart",
        targetUrl,
        createdAt: {
          gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingCount === 0) {
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      await prisma.notification.createMany({
        data: allUsers.map((u) => ({
          recipientId: u.id,
          actorId: null,
          type: "global_chart",
          text: `A Parada Global (${snapshot.weekLabel}) foi publicada! Confira os resultados.`,
          targetUrl,
          read: false,
        })),
        skipDuplicates: false,
      });
      notificationsSent = allUsers.length;
    }
  }

  return NextResponse.json({
    ok: true,
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    updatedRows,
    snapshotCreated: snapshot.created,
    notificationsSent,
  });
}
