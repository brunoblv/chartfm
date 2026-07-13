import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { getRankingWeekReference, getGlobalSnapshotDeadline } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { publishWeeklyGlobalRankings } from "@/lib/publish-weekly-globals";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/publish-weekly-globals — reconcilia de hora em hora (mesmo padrão do
// copa-advance/push-advance): só congela Global 100 + Airplay + Álbuns quando o horário
// de publicação configurado em /admin/parada-global já passou. getOrCreateRankingWeekSnapshot
// é create-only, então rodar antes da hora não faz nada além de aguardar.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const slot = await getGlobalPublishSlot();
    const rankingWeek = getRankingWeekReference(now, slot);
    const publishAt = new Date(getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot).getTime() + 60 * 60 * 1000);
    if (now < publishAt) {
      return NextResponse.json({ ok: true, skipped: true, reason: "horário de publicação configurado ainda não chegou", publishAt });
    }

    const result = await publishWeeklyGlobalRankings(now);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/publish-weekly-globals]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
