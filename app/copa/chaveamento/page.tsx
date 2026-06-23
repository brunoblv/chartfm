import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { BracketClient } from "./BracketClient";
import { getVoteCounts } from "@/lib/copa";

export const revalidate = 30;

export default async function ChaveamentoPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!copa) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Nenhuma Copa ativa.
      </div>
    );
  }

  const allFixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, phase: { not: "GROUP" } },
    include: {
      votes: true,
      artistA: { select: { id: true, ownerId: true, artistName: true, artistImage: true, artistColor: true, artistInitials: true } },
      artistB: { select: { id: true, ownerId: true, artistName: true, artistImage: true, artistColor: true, artistInitials: true } },
    },
    orderBy: [{ phase: "asc" }, { matchIndex: "asc" }],
  });

  function serFixture(f: typeof allFixtures[0]) {
    const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
    const myVote = userId ? (f.votes.find((v) => v.userId === userId)?.side ?? null) : null;
    return {
      id: f.id,
      phase: f.phase as string,
      matchIndex: f.matchIndex,
      status: f.status as string,
      votesA, votesB, goalsA, goalsB,
      myVote: myVote as "A" | "B" | null,
      artistA: f.artistA ? {
        id: f.artistA.id,
        ownerId: f.artistA.ownerId,
        artistName: f.artistA.artistName,
        artistImage: f.artistA.artistImage,
        artistColor: f.artistA.artistColor,
        artistInitials: f.artistA.artistInitials,
      } : null,
      artistB: f.artistB ? {
        id: f.artistB.id,
        ownerId: f.artistB.ownerId,
        artistName: f.artistB.artistName,
        artistImage: f.artistB.artistImage,
        artistColor: f.artistB.artistColor,
        artistInitials: f.artistB.artistInitials,
      } : null,
    };
  }

  return (
    <BracketClient
      copaId={copa.id}
      userId={userId}
      fixtures={allFixtures.map(serFixture)}
    />
  );
}
