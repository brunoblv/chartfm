import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { submitClubeNominations } from "@/lib/clube-album";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = (await req.json()) as { roundId?: string; albumIds?: number[] };
  const { roundId, albumIds } = body;

  if (!roundId || !Array.isArray(albumIds) || albumIds.length !== 2) {
    return NextResponse.json({ error: "Informe roundId e dois albumIds" }, { status: 400 });
  }

  const result = await submitClubeNominations(session.user.id, roundId, [albumIds[0], albumIds[1]]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
