import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { pushRoundTitle } from "@/lib/push-format";
import { createSystemFeedPost } from "@/lib/system-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const rounds = await prisma.pushRound.findMany({
    orderBy: { number: "desc" },
    include: { submissions: { select: { id: true } } },
  });

  return NextResponse.json(rounds.map((r) => ({ ...r, submissionCount: r.submissions.length })));
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
    season?: number;
    submissionEndsAt?: string;
    listeningEndsAt?: string;
    rankingEndsAt?: string;
  };

  if (!body.submissionEndsAt || !body.rankingEndsAt) {
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });
  }

  const submissionEndsAt = new Date(body.submissionEndsAt);
  const listeningEndsAt = body.listeningEndsAt ? new Date(body.listeningEndsAt) : submissionEndsAt;
  const rankingEndsAt = new Date(body.rankingEndsAt);

  if (listeningEndsAt < submissionEndsAt) {
    return NextResponse.json({ error: "A escuta deve começar após o fim das inscrições" }, { status: 400 });
  }
  if (rankingEndsAt <= listeningEndsAt) {
    return NextResponse.json({ error: "O fim da escuta deve ser após o início" }, { status: 400 });
  }

  const last = await prisma.pushRound.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 0) + 1;

  const round = await prisma.pushRound.create({
    data: {
      number,
      title: pushRoundTitle(body.season ?? 1, number),
      season: body.season ?? 1,
      submissionEndsAt,
      listeningEndsAt,
      rankingEndsAt,
    },
  });

  await createSystemFeedPost(
    "push_published",
    `O ${round.title} foi publicado! Indique sua música e participe.`,
    "/push",
  );

  return NextResponse.json(round, { status: 201 });
}
