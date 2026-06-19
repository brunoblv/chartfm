import { getServerSession } from "next-auth";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import PushClient, { type RoundData } from "./PushClient";

export const revalidate = 30;

async function getCurrentRound(userId: string | null) {
  const round = await prisma.pushRound.findFirst({
    orderBy: { number: "desc" },
    include: {
      submissions: {
        include: {
          song: { select: { id: true, title: true, artist: true, spotifyId: true, spotifyUrl: true } },
          user: { select: { handle: true, name: true } },
        },
      },
      votes: userId ? { where: { userId } } : false,
    },
  });

  if (!round) return null;

  const mySubmission = userId ? (round.submissions.find((s) => s.userId === userId) ?? null) : null;
  const isHidden = round.phase === "SUBMISSION";

  const submissions = isHidden
    ? null
    : round.submissions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userHandle: s.user.handle,
        userName: s.user.name,
        spotifyTrackId: s.spotifyTrackId,
        song: {
          title: s.song.title,
          artist: s.song.artist,
          coverUrl: null as string | null,
          spotifyUrl: s.song.spotifyUrl,
        },
      }));

  const myVotes = userId && round.votes
    ? (round.votes as { submissionId: string; position: number }[]).map((v) => ({
        submissionId: v.submissionId,
        position: v.position,
      }))
    : null;

  let results: object[] | null = null;
  if (round.phase === "RESULT") {
    const allVotes = await prisma.pushVote.findMany({
      where: { roundId: round.id },
      select: { submissionId: true, position: true },
    });
    const totals = new Map<string, number>();
    const total = round.submissions.length;
    const n = total - 1;
    for (const v of allVotes) {
      const pts = n <= 1 ? 10 : Math.max(1, Math.round(10 - (v.position - 1) * 9 / (n - 1)));
      totals.set(v.submissionId, (totals.get(v.submissionId) ?? 0) + pts);
    }
    const sorted = round.submissions
      .map((s) => ({ ...s, totalPoints: totals.get(s.id) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    results = sorted.map((s, i) => ({
      submissionId: s.id,
      userId: s.userId,
      userHandle: s.user.handle,
      userName: s.user.name,
      spotifyTrackId: s.spotifyTrackId,
      totalPoints: s.totalPoints,
      rank: i + 1,
      song: { title: s.song.title, artist: s.song.artist, coverUrl: null, spotifyUrl: s.song.spotifyUrl },
    }));
  }

  return {
    id: round.id,
    number: round.number,
    title: round.title,
    phase: round.phase,
    submissionEndsAt: round.submissionEndsAt.toISOString(),
    listeningEndsAt: round.listeningEndsAt.toISOString(),
    rankingEndsAt: round.rankingEndsAt.toISOString(),
    spotifyPlaylistId: round.spotifyPlaylistId,
    season: round.season,
    submissionCount: round.submissions.length,
    mySubmission: mySubmission
      ? { id: mySubmission.id, spotifyTrackId: mySubmission.spotifyTrackId, song: { title: mySubmission.song.title, artist: mySubmission.song.artist, coverUrl: null, spotifyUrl: mySubmission.song.spotifyUrl } }
      : null,
    submissions,
    myVotes,
    results,
  };
}

export default async function PushPage() {
  const session = await getServerSession(authOptions);
  const round = await getCurrentRound(session?.user?.id ?? null);

  return (
    <Shell
      title="Push"
      subtitle="Indique uma música, ouça as indicações e vote no seu favorito"
      headerRight={
        <Link
          href="/push/historico"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          Histórico →
        </Link>
      }
    >
      <PushClient initialRound={round as RoundData | null} />
    </Shell>
  );
}
