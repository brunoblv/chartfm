import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getVoteCounts } from "@/lib/copa";

export const dynamic = "force-dynamic";

function serializeArtist(a: {
  id: string; copaId: string; ownerId: string; groupLetter: string; slotInGroup: number;
  artistSpotifyId: string | null; artistName: string; artistImage: string | null;
  artistColor: string; artistInitials: string;
  owner: { id: string; name: string; handle: string; avatarColor: string };
  singles: { slotIndex: number; songId: string | null; songName: string }[];
}) {
  return {
    id: a.id,
    copaId: a.copaId,
    ownerId: a.ownerId,
    ownerName: a.owner.name,
    ownerHandle: a.owner.handle,
    ownerAvatarColor: a.owner.avatarColor,
    groupLetter: a.groupLetter,
    slotInGroup: a.slotInGroup,
    artistSpotifyId: a.artistSpotifyId,
    artistName: a.artistName,
    artistImage: a.artistImage,
    artistColor: a.artistColor,
    artistInitials: a.artistInitials,
    singles: a.singles.sort((x, y) => x.slotIndex - y.slotIndex),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const { searchParams } = new URL(req.url);
  const phase = searchParams.get("phase");
  const group = searchParams.get("group");

  const where: Record<string, unknown> = { copaId: id };
  if (phase) where.phase = phase;
  if (group) where.groupLetter = group;

  const fixtures = await prisma.copaFixture.findMany({
    where,
    orderBy: [{ groupLetter: "asc" }, { round: "asc" }, { matchIndex: "asc" }],
    include: {
      votes: true,
      artistA: {
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: { select: { slotIndex: true, songId: true, songName: true } },
        },
      },
      artistB: {
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: { select: { slotIndex: true, songId: true, songName: true } },
        },
      },
    },
  });

  const data = fixtures.map((f) => {
    const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
    const myVote = userId ? (f.votes.find((v) => v.userId === userId)?.side ?? null) : null;
    const singlesA = f.artistA.singles.sort((a, b) => a.slotIndex - b.slotIndex);
    const singlesB = f.artistB.singles.sort((a, b) => a.slotIndex - b.slotIndex);
    return {
      id: f.id,
      copaId: f.copaId,
      phase: f.phase,
      groupLetter: f.groupLetter,
      round: f.round,
      matchIndex: f.matchIndex,
      artistA: serializeArtist(f.artistA),
      artistB: serializeArtist(f.artistB),
      singleAIdx: f.singleAIdx,
      singleBIdx: f.singleBIdx,
      singleAName: singlesA[f.singleAIdx]?.songName ?? "",
      singleBName: singlesB[f.singleBIdx]?.songName ?? "",
      votesA,
      votesB,
      goalsA,
      goalsB,
      status: f.status,
      myVote: myVote as "A" | "B" | null,
    };
  });

  return NextResponse.json({ fixtures: data });
}
