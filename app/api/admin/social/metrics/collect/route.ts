import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { collectSocialMetrics } from "@/lib/social/metrics/collector";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/admin/social/metrics/collect — "Coletar agora" em /admin/redes-sociais (ignora a frequência do cron)
export async function POST() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const summary = await collectSocialMetrics({ force: true });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[admin/social/metrics/collect]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
