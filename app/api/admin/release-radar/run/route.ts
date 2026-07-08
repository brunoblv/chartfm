import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { runReleaseRadar } from "@/lib/release-radar";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST — dispara a checagem do radar manualmente (botão "Verificar agora" do admin)
export async function POST() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await runReleaseRadar();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
