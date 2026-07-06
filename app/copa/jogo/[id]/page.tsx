import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { MatchClient } from "./MatchClient";
import { getVoteCounts, pickSingleCover, resolveSongCoverUrls } from "@/lib/copa";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CopaMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const f = await prisma.copaFixture.findUnique({
    where: { id },
    include: {
      votes: true,
      copa: { select: { id: true, name: true, year: true, votesPerGoal: true } },
      artistA: {
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: { select: { slotIndex: true, songName: true, songId: true } },
        },
      },
      artistB: {
        include: {
          owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
          singles: { select: { slotIndex: true, songName: true, songId: true } },
        },
      },
    },
  });

  if (!f) notFound();

  const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f, f.copa.votesPerGoal);
  const myVote = userId ? (f.votes.find((v) => v.userId === userId)?.side ?? null) : null;
  const singlesA = [...f.artistA.singles].sort((a, b) => a.slotIndex - b.slotIndex);
  const singlesB = [...f.artistB.singles].sort((a, b) => a.slotIndex - b.slotIndex);
  const singleASongId = singlesA[f.singleAIdx]?.songId ?? null;
  const singleBSongId = singlesB[f.singleBIdx]?.songId ?? null;
  const coverMap = await resolveSongCoverUrls([singleASongId, singleBSongId]);

  // A música em disputa só é revelada no momento do jogo (Ao vivo ou Encerrado).
  // A escalação completa de singles nunca é exposta aos usuários.
  const revealed = f.status === "LIVE" || f.status === "DONE";

  return (
    <MatchClient
      fixture={{
        id: f.id,
        copaId: f.copaId,
        phase: f.phase as string,
        groupLetter: f.groupLetter,
        round: f.round,
        matchIndex: f.matchIndex,
        status: f.status as string,
        singleAIdx: f.singleAIdx,
        singleBIdx: f.singleBIdx,
        singleAName: revealed ? singlesA[f.singleAIdx]?.songName ?? "" : "",
        singleBName: revealed ? singlesB[f.singleBIdx]?.songName ?? "" : "",
        singleACover: revealed ? pickSingleCover(singleASongId, coverMap) : null,
        singleBCover: revealed ? pickSingleCover(singleBSongId, coverMap) : null,
        votesA,
        votesB,
        goalsA,
        goalsB,
        myVote: myVote as "A" | "B" | null,
        artistA: {
          id: f.artistA.id,
          ownerId: f.artistA.ownerId,
          ownerName: f.artistA.owner.name,
          ownerHandle: f.artistA.owner.handle,
          groupLetter: f.artistA.groupLetter,
          artistName: f.artistA.artistName,
          artistImage: f.artistA.artistImage,
          artistColor: f.artistA.artistColor,
          artistInitials: f.artistA.artistInitials,
        },
        artistB: {
          id: f.artistB.id,
          ownerId: f.artistB.ownerId,
          ownerName: f.artistB.owner.name,
          ownerHandle: f.artistB.owner.handle,
          groupLetter: f.artistB.groupLetter,
          artistName: f.artistB.artistName,
          artistImage: f.artistB.artistImage,
          artistColor: f.artistB.artistColor,
          artistInitials: f.artistB.artistInitials,
        },
      }}
      userId={userId}
    />
  );
}
