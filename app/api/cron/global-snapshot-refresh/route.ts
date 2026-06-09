import { NextRequest, NextResponse } from "next/server";
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

  const snapshot = await getOrCreateRankingWeekSnapshot(new Date());

  return NextResponse.json({
    ok: true,
    created: snapshot.created,
    weekIndex: snapshot.weekIndex,
    weekLabel: snapshot.weekLabel,
    dateRange: snapshot.dateRange,
  });
}
