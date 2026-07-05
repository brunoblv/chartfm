import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import type { CrownnoteUserExport } from "@/lib/crownnote-export";
import { matchCrownnoteExport } from "@/lib/crownnote-song-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403, headers: NO_CACHE });
  }

  let body: { export?: CrownnoteUserExport };
  try {
    body = (await req.json()) as { export?: CrownnoteUserExport };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_CACHE });
  }

  if (!body.export?.charts?.length) {
    return NextResponse.json({ error: "Exportação Crownnote inválida." }, { status: 400, headers: NO_CACHE });
  }

  const songs = await matchCrownnoteExport(body.export);
  const matched = songs.filter((s) => s.status === "matched").length;

  return NextResponse.json(
    {
      ok: true,
      songs,
      stats: {
        uniqueSongs: songs.length,
        matched,
        unmatched: songs.length - matched,
      },
    },
    { headers: NO_CACHE },
  );
}
