import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rounds = await prisma.pushRound.findMany({
    where: { phase: "RESULT" },
    orderBy: { number: "desc" },
    include: {
      submissions: {
        include: {
          user: { select: { handle: true, name: true } },
          song: { select: { title: true, artist: true, spotifyUrl: true } },
        },
      },
      votes: { select: { submissionId: true, position: true } },
    },
  });

  const result = rounds.map((round) => {
    const totals = new Map<string, number>();
    const total = round.submissions.length;
    const n = total - 1;
    for (const v of round.votes) {
      const pts = n <= 1 ? 10 : Math.max(1, Math.round(10 - (v.position - 1) * 9 / (n - 1)));
      totals.set(v.submissionId, (totals.get(v.submissionId) ?? 0) + pts);
    }
    const sorted = round.submissions
      .map((s) => ({ ...s, totalPoints: totals.get(s.id) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return {
      id: round.id,
      number: round.number,
      title: round.title,
      season: round.season,
      spotifyPlaylistId: round.spotifyPlaylistId,
      createdAt: round.createdAt.toISOString(),
      results: sorted.map((s, i) => ({
        rank: i + 1,
        userHandle: s.user.handle,
        userName: s.user.name,
        totalPoints: s.totalPoints,
        song: { title: s.song.title, artist: s.song.artist, spotifyUrl: s.song.spotifyUrl },
      })),
    };
  });

  return NextResponse.json({ rounds: result });
}
