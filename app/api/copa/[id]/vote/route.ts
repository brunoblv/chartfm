import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { votesToGoals } from "@/lib/copa";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { fixtureId, side } = body as { fixtureId: string; side: "A" | "B" };

  if (!fixtureId || (side !== "A" && side !== "B")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const fixture = await prisma.copaFixture.findUnique({
    where: { id: fixtureId },
    include: { copa: { select: { votesPerGoal: true } } },
  });
  if (!fixture || fixture.copaId !== id || fixture.status !== "LIVE") {
    return NextResponse.json({ error: "Fixture not available for voting" }, { status: 400 });
  }

  const votesPerGoal = fixture.copa.votesPerGoal;

  // Votação aberta a qualquer usuário logado (não precisa ser participante da
  // Copa). Mantém 1 voto por jogo via @@unique(fixtureId, userId).
  try {
    const vote = await prisma.copaVote.create({
      data: { fixtureId, userId: session.user.id, side },
    });
    const [votesA, votesB] = await Promise.all([
      prisma.copaVote.count({ where: { fixtureId, side: "A" } }),
      prisma.copaVote.count({ where: { fixtureId, side: "B" } }),
    ]);
    return NextResponse.json({
      vote: { id: vote.id, side: vote.side },
      votesA,
      votesB,
      goalsA: votesToGoals(votesA, votesPerGoal),
      goalsB: votesToGoals(votesB, votesPerGoal),
    });
  } catch {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }
}
