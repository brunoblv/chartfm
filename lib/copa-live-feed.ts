import { prisma } from "@/lib/prisma";
import { getVoteCounts, pickSingleCover, resolveSongCoverUrls } from "@/lib/copa";

const PHASE_LABELS: Record<string, string> = {
  R32: "1/16 de Final",
  R16: "Oitavas de Final",
  QF: "Quartas de Final",
  SF: "Semifinal",
  THIRD_PLACE: "Disputa pelo 3º Lugar",
  FINAL: "Final",
};

function phaseLabel(f: { phase: string; groupLetter: string | null; round: number | null }): string {
  if (f.phase === "GROUP") return `Grupo ${f.groupLetter} · Rodada ${f.round} de 3`;
  return PHASE_LABELS[f.phase] ?? f.phase;
}

export type CopaLiveFeedFixture = {
  id: string;
  phaseLabel: string;
  singleAName: string;
  singleBName: string;
  singleACover: string | null;
  singleBCover: string | null;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  artistA: {
    artistName: string;
    artistImage: string | null;
    artistColor: string;
    artistInitials: string;
  };
  artistB: {
    artistName: string;
    artistImage: string | null;
    artistColor: string;
    artistInitials: string;
  };
};

export type CopaLiveFeedData = {
  copaId: string;
  copaName: string;
  fixtures: CopaLiveFeedFixture[];
};

export async function getCopaLiveFeedFixtures(userId: string | null): Promise<CopaLiveFeedData | null> {
  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, votesPerGoal: true },
  });

  if (!copa) return null;

  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, status: "LIVE" },
    include: {
      votes: true,
      artistA: { include: { singles: { select: { slotIndex: true, songName: true, songId: true } } } },
      artistB: { include: { singles: { select: { slotIndex: true, songName: true, songId: true } } } },
    },
    orderBy: [{ phase: "asc" }, { groupLetter: "asc" }, { matchIndex: "asc" }],
  });

  if (fixtures.length === 0) return null;

  const coverMap = await resolveSongCoverUrls(
    fixtures.flatMap((f) => {
      const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
      const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
      return [sA?.songId, sB?.songId];
    }),
  );

  return {
    copaId: copa.id,
    copaName: copa.name,
    fixtures: fixtures.map((f) => {
      const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f, copa.votesPerGoal);
      const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
      const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
      return {
        id: f.id,
        phaseLabel: phaseLabel(f),
        singleAName: sA?.songName ?? "",
        singleBName: sB?.songName ?? "",
        singleACover: pickSingleCover(sA?.songId, coverMap),
        singleBCover: pickSingleCover(sB?.songId, coverMap),
        votesA,
        votesB,
        goalsA,
        goalsB,
        myVote: userId ? ((f.votes.find((v) => v.userId === userId)?.side ?? null) as "A" | "B" | null) : null,
        artistA: {
          artistName: f.artistA.artistName,
          artistImage: f.artistA.artistImage,
          artistColor: f.artistA.artistColor,
          artistInitials: f.artistA.artistInitials,
        },
        artistB: {
          artistName: f.artistB.artistName,
          artistImage: f.artistB.artistImage,
          artistColor: f.artistB.artistColor,
          artistInitials: f.artistB.artistInitials,
        },
      };
    }),
  };
}
