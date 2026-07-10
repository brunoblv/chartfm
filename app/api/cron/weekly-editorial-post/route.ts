import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { publishWeeklyEditorialPost } from "@/lib/weekly-editorial-post";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/weekly-editorial-post — terça 5h20 BRT (após publish-weekly-globals):
// publica automaticamente o panorama editorial da semana do Global 100, a partir de dados reais.
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await publishWeeklyEditorialPost(new Date());
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[cron/weekly-editorial-post]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
