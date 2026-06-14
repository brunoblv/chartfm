import { NextResponse } from "next/server";
import { requireMyTrlSession, authorizeMyTrlCron } from "@/lib/mytrl-access";
import { generateMyTrlSnapshot } from "@/lib/mytrl-generate";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// POST /api/mytrl/generate — gera snapshot manualmente (somente @bruno ou cron)
export async function POST(req: Request) {
  const session = await requireMyTrlSession();
  const cronOk = authorizeMyTrlCron(req);
  if (!session && !cronOk) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await generateMyTrlSnapshot(new Date());
    if (!result.ok) {
      const status = result.skipped ? 200 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
