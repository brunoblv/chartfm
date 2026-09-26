import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getSocialAnalyticsData, postsToCsv } from "@/lib/social/metrics/dashboard";

export const runtime = "nodejs";

// GET /api/admin/social/metrics/export?days=90 — CSV com todas as métricas por post para análise externa
export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  const data = await getSocialAnalyticsData(days);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(postsToCsv(data.posts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chartfm-redes-sociais-${days}d-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
