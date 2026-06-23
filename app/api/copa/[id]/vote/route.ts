import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

  const fixture = await prisma.copaFixture.findUnique({ where: { id: fixtureId } });
  if (!fixture || fixture.copaId !== id || fixture.status !== "LIVE") {
    return NextResponse.json({ error: "Fixture not available for voting" }, { status: 400 });
  }

  // Check if user is a participant
  const participant = await prisma.copaParticipant.findUnique({
    where: { copaId_userId: { copaId: id, userId: session.user.id } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

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
      goalsA: Math.floor(votesA / 2),
      goalsB: Math.floor(votesB / 2),
    });
  } catch {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }
}
