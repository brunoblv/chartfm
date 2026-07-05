import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { toggleWeeklyPollVote } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

// POST /api/weekly-poll/vote — alterna o voto do usuário numa opção da enquete aberta
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Faça login para votar." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { optionId?: string } | null;
  const optionId = body?.optionId?.trim();
  if (!optionId) {
    return NextResponse.json({ error: "Informe optionId." }, { status: 400 });
  }

  const result = await toggleWeeklyPollVote(session.user.id, optionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, voted: result.voted, voteCount: result.voteCount });
}
