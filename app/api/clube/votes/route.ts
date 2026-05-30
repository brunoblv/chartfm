import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { submitClubeVotes } from "@/lib/clube-album";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = (await req.json()) as { roundId?: string; nominationIds?: string[] };
  const { roundId, nominationIds } = body;

  if (!roundId || !Array.isArray(nominationIds) || nominationIds.length === 0) {
    return NextResponse.json({ error: "Informe roundId e nominationIds" }, { status: 400 });
  }

  const result = await submitClubeVotes(session.user.id, roundId, nominationIds);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
