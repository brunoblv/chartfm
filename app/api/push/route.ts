import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { fetchSpotifyTrackCovers } from "@/lib/spotify-server";
import { computePushRoundScores } from "@/lib/push-scoring";
import { pushRoundTitle } from "@/lib/push-format";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const round = await prisma.pushRound.findFirst({
    orderBy: { number: "desc" },
    include: {
      submissions: {
        include: {
          song: { select: { id: true, title: true, artist: true, spotifyId: true, spotifyUrl: true } },
          user: { select: { id: true, handle: true, name: true, avatarColor: true } },
        },
      },
      votes: userId ? { where: { userId } } : false,
    },
  });

  if (!round) return NextResponse.json({ round: null });

  const mySubmission = userId
    ? (round.submissions.find((s) => s.userId === userId) ?? null)
    : null;

  const isHidden = round.phase === "SUBMISSION";
  const revealUsers = round.phase === "RESULT";

  // Buscar capas do Spotify: músicas visíveis + indicação própria
  const trackIdsForCovers: string[] = [];
  if (!isHidden) {
    for (const s of round.submissions) trackIdsForCovers.push(s.spotifyTrackId);
  } else if (mySubmission) {
    trackIdsForCovers.push(mySubmission.spotifyTrackId);
  }
  const coverMap = trackIdsForCovers.length > 0
    ? await fetchSpotifyTrackCovers(trackIdsForCovers)
    : new Map<string, string | null>();

  const submissions = isHidden
    ? null
    : round.submissions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userHandle: revealUsers ? s.user.handle : null,
        userName: revealUsers ? s.user.name : null,
        spotifyTrackId: s.spotifyTrackId,
        song: {
          title: s.song.title,
          artist: s.song.artist,
          coverUrl: coverMap.get(s.spotifyTrackId) ?? null,
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
      select: { userId: true, submissionId: true, position: true },
    });
    const totals = computePushRoundScores(
      round.submissions.map((s) => ({ id: s.id, userId: s.userId })),
      allVotes,
    );
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
      song: { title: s.song.title, artist: s.song.artist, coverUrl: coverMap.get(s.spotifyTrackId) ?? null, spotifyUrl: s.song.spotifyUrl },
    }));
  }

  const participants = round.submissions.map((s) => ({
    userId: s.userId,
    handle: s.user.handle,
    name: s.user.name,
    avatarColor: s.user.avatarColor,
    isMe: s.userId === userId,
  }));

  return NextResponse.json({
    round: {
      id: round.id,
      number: round.number,
      title: pushRoundTitle(round.season, round.number),
      phase: round.phase,
      submissionEndsAt: round.submissionEndsAt.toISOString(),
      listeningEndsAt: round.listeningEndsAt.toISOString(),
      rankingEndsAt: round.rankingEndsAt.toISOString(),
      spotifyPlaylistId: round.spotifyPlaylistId,
      youtubePlaylistId: round.youtubePlaylistId,
      season: round.season,
      submissionCount: round.submissions.length,
      mySubmission: mySubmission
        ? {
            id: mySubmission.id,
            spotifyTrackId: mySubmission.spotifyTrackId,
            song: {
              title: mySubmission.song.title,
              artist: mySubmission.song.artist,
              coverUrl: coverMap.get(mySubmission.spotifyTrackId) ?? null,
              spotifyUrl: mySubmission.song.spotifyUrl,
            },
          }
        : null,
      submissions,
      myVotes,
      results,
      participants,
    },
  });
}
