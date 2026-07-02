import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { PARADA_TRASH_DAYS } from "@/lib/paradas";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/purge-deleted-paradas — 3h BRT: apaga definitivamente paradas na lixeira há mais de 7 dias
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - PARADA_TRASH_DAYS * 24 * 60 * 60 * 1000);
    const toPurge = await prisma.parada.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });

    // Parada.charts é onDelete: Cascade, e tudo abaixo de Chart (entries, likes, reposts,
    // comentários) também cascateia a partir de Chart — não precisa apagar manualmente.
    for (const { id } of toPurge) {
      await prisma.parada.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true, purged: toPurge.length });
  } catch (err) {
    console.error("[cron/purge-deleted-paradas]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
