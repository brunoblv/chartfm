import { NextRequest, NextResponse } from "next/server";
import { refreshAllEntityPageSnapshots } from "@/lib/entity-page-snapshot/refresh";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Atualiza snapshots diários das páginas de artista, álbum e música (6h BRT via Vercel Cron). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await refreshAllEntityPageSnapshots();
  return NextResponse.json({ ok: true, ...result });
}
