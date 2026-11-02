import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getInstagramDashboard, InstagramApiError, parseIgRange } from "@/lib/social/instagram-insights";
import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const range = parseIgRange(req.nextUrl.searchParams.get("range"));
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const data = await getInstagramDashboard(range, { refresh });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof InstagramApiError ? 502 : 500;
    console.error("[admin/instagram] falha ao montar dashboard", sanitizeErrorMessage(err));
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status });
  }
}
