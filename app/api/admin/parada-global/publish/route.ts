import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { getRankingWeekReference, getGlobalSnapshotDeadline } from "@/lib/chart-week";
import { publishWeeklyGlobalRankings } from "@/lib/publish-weekly-globals";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/admin/parada-global/publish — botão manual em /admin/parada-global, para os casos em
// que o cron de hora em hora (publish-weekly-globals) não rodou. Só libera 5min depois do horário
// configurado (mesma folga de 1h do cron + 5min de margem) e bloqueia se a semana já foi publicada.
export async function POST() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const now = new Date();
  const slot = await getGlobalPublishSlot();
  const rankingWeek = getRankingWeekReference(now, slot);
  const deadline = getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot);
  const publishAt = new Date(deadline.getTime() + 60 * 60 * 1000);
  const unlockAt = new Date(publishAt.getTime() + 5 * 60 * 1000);

  if (now < unlockAt) {
    return NextResponse.json(
      { error: "Ainda não chegou o horário liberado para publicação manual.", unlockAt: unlockAt.toISOString() },
      { status: 400 },
    );
  }

  const existing = await prisma.globalSnapshot.findUnique({
    where: { weekIndex: rankingWeek.weekIndex },
    select: { weekIndex: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A Parada Global desta semana já foi publicada.", weekIndex: rankingWeek.weekIndex },
      { status: 409 },
    );
  }

  const result = await publishWeeklyGlobalRankings(now);
  return NextResponse.json({ ok: true, ...result });
}
