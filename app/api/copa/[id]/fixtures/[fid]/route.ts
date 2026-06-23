import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getVoteCounts } from "@/lib/copa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const f = await prisma.copaFixture.findUnique({
    where: { id: fid },
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

  if (!f || f.copaId !== id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
  const myVote = userId ? (f.votes.find((v) => v.userId === userId)?.side ?? null) : null;
  const singlesA = f.artistA.singles.sort((a, b) => a.slotIndex - b.slotIndex);
  const singlesB = f.artistB.singles.sort((a, b) => a.slotIndex - b.slotIndex);

  return NextResponse.json({
    fixture: {
      id: f.id,
      copaId: f.copaId,
      phase: f.phase,
      groupLetter: f.groupLetter,
      round: f.round,
      matchIndex: f.matchIndex,
      artistA: {
        id: f.artistA.id,
        ownerId: f.artistA.ownerId,
        ownerName: f.artistA.owner.name,
        ownerHandle: f.artistA.owner.handle,
        ownerAvatarColor: f.artistA.owner.avatarColor,
        groupLetter: f.artistA.groupLetter,
        artistName: f.artistA.artistName,
        artistImage: f.artistA.artistImage,
        artistColor: f.artistA.artistColor,
        artistInitials: f.artistA.artistInitials,
        singles: singlesA,
      },
      artistB: {
        id: f.artistB.id,
        ownerId: f.artistB.ownerId,
        ownerName: f.artistB.owner.name,
        ownerHandle: f.artistB.owner.handle,
        ownerAvatarColor: f.artistB.owner.avatarColor,
        groupLetter: f.artistB.groupLetter,
        artistName: f.artistB.artistName,
        artistImage: f.artistB.artistImage,
        artistColor: f.artistB.artistColor,
        artistInitials: f.artistB.artistInitials,
        singles: singlesB,
      },
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
      allVoters: f.votes.map((v) => ({ userId: v.userId, side: v.side })),
    },
  });
}
