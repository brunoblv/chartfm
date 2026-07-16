import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { probeSpotifyApi, probeSpotifyBackupApi } from "@/lib/spotify-server";
import { getSpotifyUsageSummary } from "@/lib/spotify-usage-log";
import { getSpotifyBudgetStatus } from "@/lib/spotify-budget";

export const runtime = "nodejs";

/**
 * target=primary|backup — testa (sob demanda) a API principal ou a de backup do Spotify.
 * target=usage[&hours=24] — resumo do log de uso (de onde vem o consumo), usado em /admin/logs.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const target = req.nextUrl.searchParams.get("target");

  if (target === "usage") {
    const hours = Math.min(48, Math.max(1, Number(req.nextUrl.searchParams.get("hours")) || 24));
    return NextResponse.json({ target, ...getSpotifyUsageSummary(hours), budgets: getSpotifyBudgetStatus() });
  }

  if (target !== "primary" && target !== "backup") {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const result = target === "primary" ? await probeSpotifyApi() : await probeSpotifyBackupApi();
  return NextResponse.json({ target, ...result });
}
