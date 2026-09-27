import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { syncInstagramFollowerDays } from "@/lib/instagram-analytics/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/instagram-insights — diário: guarda saldo de seguidores do IG (a API só guarda 30 dias)
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await syncInstagramFollowerDays();
  if (!result.ok) console.error("[cron/instagram-insights]", result.error);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
