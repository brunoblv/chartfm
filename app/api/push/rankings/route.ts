import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season");

  const where = season ? { round: { season: Number(season), phase: "RESULT" as const } } : { round: { phase: "RESULT" as const } };

  const votes = await prisma.pushVote.findMany({
    where,
    include: {
      submission: {
        include: {
          user: { select: { handle: true, name: true } },
          song: { select: { title: true, artist: true, spotifyUrl: true } },
          round: { select: { submissions: { select: { id: true } } } },
        },
      },
    },
  });

  const userPoints = new Map<string, { handle: string; name: string; points: number; wins: number }>();

  for (const vote of votes) {
    const totalInRound = vote.submission.round.submissions.length;
    const n = totalInRound - 1;
    const pts = n <= 1 ? 10 : Math.max(1, Math.round(10 - (vote.position - 1) * 9 / (n - 1)));

    const uid = vote.submission.userId;
    const entry = userPoints.get(uid);
    if (entry) {
      entry.points += pts;
      if (vote.position === 1) entry.wins += 1;
    } else {
      userPoints.set(uid, {
        handle: vote.submission.user.handle,
        name: vote.submission.user.name,
        points: pts,
        wins: vote.position === 1 ? 1 : 0,
      });
    }
  }

  const ranking = [...userPoints.entries()]
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return NextResponse.json({ ranking });
}
