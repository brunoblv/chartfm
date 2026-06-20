import { NextResponse } from "next/server";
import { authorizeMyTrlCron } from "@/lib/mytrl-access";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import { parseMyTrlReferenceDate } from "@/lib/mytrl-chart-engine";
import { runDailyMyTrlJob } from "@/lib/mytrl-daily-parada";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// POST /api/mytrl/generate — gera snapshot + publica na UMS Request Live (@bruno ou cron)
// Body opcional: { "date": "YYYY-MM-DD" } — simula um dia no passado (8h BRT)
export async function POST(req: Request) {
  const session = await requireMyTrlSession();
  const cronOk = authorizeMyTrlCron(req);
  if (!session && !cronOk) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let referenceDay = new Date();
  try {
    const body = await req.json().catch(() => null);
    const dateParam = typeof body?.date === "string" ? body.date.trim() : "";
    if (dateParam) {
      const parsed = parseMyTrlReferenceDate(dateParam);
      if (!parsed) {
        return NextResponse.json(
          { ok: false, error: "Data inválida. Use YYYY-MM-DD (seg–sex, dia no passado ou hoje)." },
          { status: 400 },
        );
      }
      referenceDay = parsed;
    }
  } catch {
    // body vazio → usa hoje
  }

  try {
    const result = await runDailyMyTrlJob(referenceDay);
    if (!result.ok) {
      const status = result.skipped ? 200 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json({
      ok: true,
      weekday: result.snapshot.weekday,
      weekIndex: result.snapshot.weekIndex,
      count: result.snapshot.count,
      referenceDate: result.snapshot.referenceDate,
      weekLabel: result.publish.weekLabel,
      chartId: result.publish.chartId,
      published: result.publish.count,
      created: result.publish.created,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
