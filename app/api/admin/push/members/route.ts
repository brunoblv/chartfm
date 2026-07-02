import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { pushRoundTitle } from "@/lib/push-format";
import { fetchSpotifyTrackCovers } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const roundId = req.nextUrl.searchParams.get("roundId");

  const round = roundId
    ? await prisma.pushRound.findUnique({
        where: { id: roundId },
        include: {
          submissions: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, handle: true, name: true, avatarColor: true } },
              song: { select: { title: true, artist: true, spotifyUrl: true } },
            },
          },
          votes: { select: { userId: true } },
        },
      })
    : await prisma.pushRound.findFirst({
        orderBy: { number: "desc" },
        include: {
          submissions: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, handle: true, name: true, avatarColor: true } },
              song: { select: { title: true, artist: true, spotifyUrl: true } },
            },
          },
          votes: { select: { userId: true } },
        },
      });

  if (!round) {
    return NextResponse.json({ round: null, submissions: [] });
  }

  const voters = new Set(round.votes.map((v) => v.userId));
  const trackIds = round.submissions.map((s) => s.spotifyTrackId);
  const coverMap = trackIds.length > 0 ? await fetchSpotifyTrackCovers(trackIds) : new Map<string, string | null>();

  return NextResponse.json({
    round: {
      id: round.id,
      number: round.number,
      season: round.season,
      phase: round.phase,
      title: pushRoundTitle(round.season, round.number),
      submissionCount: round.submissions.length,
    },
    submissions: round.submissions.map((s, index) => ({
      id: s.id,
      order: index + 1,
      userId: s.userId,
      handle: s.user.handle,
      name: s.user.name,
      avatarColor: s.user.avatarColor,
      hasVoted: voters.has(s.userId),
      createdAt: s.createdAt.toISOString(),
      spotifyTrackId: s.spotifyTrackId,
      song: {
        title: s.song.title,
        artist: s.song.artist,
        spotifyUrl: s.song.spotifyUrl,
        coverUrl: coverMap.get(s.spotifyTrackId) ?? null,
      },
    })),
  });
}
