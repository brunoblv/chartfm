import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { importGlobalTopArtists } from "@/lib/release-radar";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/release-radar-import — terça 12h: sincroniza o radar com o top 200 do Global da semana
export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await importGlobalTopArtists();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[cron/release-radar-import]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
