import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { importGlobalTopArtists } from "@/lib/release-radar";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST — importa os 200 artistas que mais pontuaram no Global da semana (botão do admin)
export async function POST() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await importGlobalTopArtists();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
