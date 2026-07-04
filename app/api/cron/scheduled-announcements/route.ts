import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { processDueScheduledAnnouncements } from "@/lib/process-scheduled-announcements";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/scheduled-announcements — processa avisos agendados/recorrentes
export async function GET(req: Request) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await processDueScheduledAnnouncements();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/scheduled-announcements]", err);
    return NextResponse.json({ error: "Falha ao processar avisos." }, { status: 500 });
  }
}
