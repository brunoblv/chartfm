import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { addReleaseWatch, getReleaseRadarAdminData } from "@/lib/release-radar";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const data = await getReleaseRadarAdminData();
  return NextResponse.json(data);
}

// POST { spotifyId } — adiciona (ou reativa) um artista no radar
export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { spotifyId?: string } | null;
  if (!body?.spotifyId?.trim()) {
    return NextResponse.json({ error: "spotifyId obrigatório" }, { status: 400 });
  }

  const result = await addReleaseWatch(body.spotifyId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
