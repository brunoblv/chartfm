import { NextRequest, NextResponse } from "next/server";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";
import { saveGlobalLastfmSnapshotForWeek } from "@/lib/global-lastfm-snapshot";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Recalcula o snapshot Global 100 Álbuns de uma semana (evita timeout do rebuild completo). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const weekIndex = Number(req.nextUrl.searchParams.get("weekIndex"));
  if (!Number.isFinite(weekIndex) || weekIndex < GLOBAL_RANKING_FIRST_WEEK_INDEX) {
    return NextResponse.json(
      { error: `weekIndex inválido (mínimo ${GLOBAL_RANKING_FIRST_WEEK_INDEX})` },
      { status: 400 },
    );
  }

  const result = await saveGlobalLastfmSnapshotForWeek("albums", weekIndex);

  return NextResponse.json({
    ok: true,
    weekIndex: result.weekIndex,
    entriesCount: result.payload.entries.length,
    contributorCount: result.payload.contributorCount,
    scoringWindow: result.payload.scoringWindow,
  });
}
