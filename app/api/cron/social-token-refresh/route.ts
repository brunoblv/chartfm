import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { socialTokenRefreshService } from "@/lib/social/credentials/social-token-refresh-service";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/social-token-refresh — diário às 04:00 BRT: renova tokens Instagram/Threads próximos do vencimento
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const results = await socialTokenRefreshService.refreshDueTokens();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/social-token-refresh]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
