import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computePushRoundScores, rankPushSubmissions } from "@/lib/push-scoring";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season");

  const rounds = await prisma.pushRound.findMany({
    where: season ? { season: Number(season), phase: "RESULT" } : { phase: "RESULT" },
    include: {
      submissions: {
        select: {
          id: true,
          userId: true,
          user: { select: { handle: true, name: true } },
        },
      },
      votes: { select: { userId: true, submissionId: true, position: true } },
    },
  });

  const userPoints = new Map<string, { handle: string; name: string; points: number; wins: number }>();

  for (const round of rounds) {
    const submissionRows = round.submissions.map((s) => ({ id: s.id, userId: s.userId }));
    const totals = computePushRoundScores(submissionRows, round.votes);
    const ranked = rankPushSubmissions(submissionRows, totals);

    for (const row of ranked) {
      const sub = round.submissions.find((s) => s.id === row.id)!;
      const entry = userPoints.get(sub.userId);
      if (entry) {
        entry.points += row.totalPoints;
        if (row.rank === 1) entry.wins += 1;
      } else {
        userPoints.set(sub.userId, {
          handle: sub.user.handle,
          name: sub.user.name,
          points: row.totalPoints,
          wins: row.rank === 1 ? 1 : 0,
        });
      }
    }
  }

  const ranking = [...userPoints.entries()]
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return NextResponse.json({ ranking });
}
