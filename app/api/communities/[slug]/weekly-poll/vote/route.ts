import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCommunityBySlug, getCommunityMemberRole } from "@/lib/community-auth";
import { submitWeeklyPollRanking, type SpotlightCategory } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

type Body = {
  category?: SpotlightCategory;
  positions?: { optionId: string; position: number }[];
};

// POST /api/communities/[slug]/weekly-poll/vote — ranking só para membros da comunidade
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Faça login para votar." }, { status: 401 });
  }

  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const role = await getCommunityMemberRole(community.id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Só membros da comunidade podem votar nesta enquete." }, { status: 403 });
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
    where: { communityId: community.id },
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
