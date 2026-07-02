import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  const { roundId } = await params;
  const body = (await req.json()) as { votes?: { submissionId: string; position: number }[] };
  const votes = body.votes;

  if (!Array.isArray(votes) || votes.length === 0) {
    return NextResponse.json({ error: "votes obrigatório" }, { status: 400 });
  }

  const round = await prisma.pushRound.findUnique({
    where: { id: roundId },
    include: {
      submissions: { select: { id: true, userId: true } },
    },
  });

  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });
  if (round.phase !== "LISTENING" && round.phase !== "RANKING") {
    return NextResponse.json({ error: "Fora do período de escuta e avaliação" }, { status: 400 });
  }

  // Qualquer usuário logado pode avaliar (não precisa ter inscrito música).
  // Quem participou não avalia a própria indicação.
  const mySubmission = round.submissions.find((s) => s.userId === session.user.id);
  const eligibleIds = new Set(
    mySubmission
      ? round.submissions.filter((s) => s.id !== mySubmission.id).map((s) => s.id)
      : round.submissions.map((s) => s.id),
  );
  for (const v of votes) {
    if (!eligibleIds.has(v.submissionId)) {
      return NextResponse.json({ error: `Inscrição inválida: ${v.submissionId}` }, { status: 400 });
    }
  }

  const total = eligibleIds.size;
  const positions = votes.map((v) => v.position);
  const expectedPositions = new Set(Array.from({ length: total }, (_, i) => i + 1));
  const valid = positions.every((p) => expectedPositions.has(p)) && new Set(positions).size === positions.length;
  if (!valid) {
    return NextResponse.json({ error: "Posições inválidas — todas as músicas devem ser rankeadas uma vez" }, { status: 400 });
  }

  await prisma.$transaction(
    votes.map((v) =>
      prisma.pushVote.upsert({
        where: { roundId_userId_submissionId: { roundId, userId, submissionId: v.submissionId } },
        create: { roundId, userId, submissionId: v.submissionId, position: v.position },
        update: { position: v.position },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
