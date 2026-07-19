import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { submitWeeklyPollRanking, type SpotlightCategory } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

type Body = {
  category?: SpotlightCategory;
  positions?: { optionId: string; position: number }[];
};

// POST /api/weekly-poll/vote — salva o ranking completo do usuário numa categoria da enquete aberta
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Faça login para votar." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const category = body?.category;
  const positions = body?.positions;
  if (category !== "destaque" && category !== "flashback") {
    return NextResponse.json({ error: "Informe uma categoria válida." }, { status: 400 });
  }
  if (!Array.isArray(positions)) {
    return NextResponse.json({ error: "Informe positions." }, { status: 400 });
  }

  const poll = await prisma.weeklySpotlightPoll.findFirst({
    where: { communityId: null },
    orderBy: { weekIndex: "desc" },
    select: { id: true },
  });
  if (!poll) {
    return NextResponse.json({ error: "Nenhuma enquete encontrada." }, { status: 404 });
  }

  const result = await submitWeeklyPollRanking(session.user.id, poll.id, category, positions);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
