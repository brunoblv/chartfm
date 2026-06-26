import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { CopaHomeClient } from "./CopaHomeClient";
import { computeStandings, getVoteCounts, pickSingleCover, resolveSongCoverUrls } from "@/lib/copa";

export const revalidate = 10;

export default async function CopaPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, handle: true, avatarColor: true } } },
      },
    },
  });

  if (!copa) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Nenhuma Copa ativa</div>
        <div style={{ fontSize: 14 }}>Aguarde o início da próxima edição.</div>
      </div>
    );
  }

  // Fetch live and recent fixtures
  const liveFixture = await prisma.copaFixture.findFirst({
    where: { copaId: copa.id, status: "LIVE" },
    include: {
      votes: true,
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: { matchIndex: "asc" },
  });

  const recentDone = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, status: "DONE" },
    include: {
      votes: true,
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: { endedAt: "desc" },
    take: 4,
  });

  const upcoming = await prisma.copaFixture.findFirst({
    where: { copaId: copa.id, status: "UPCOMING" },
    include: {
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: { matchIndex: "asc" },
  });

  // User's artists + standings
  const myArtists = userId
    ? await prisma.copaArtist.findMany({
        where: { copaId: copa.id, ownerId: userId },
        include: { singles: true },
      })
    : [];

  // Compute standings for user's artists groups
  const groupLetters = [...new Set(myArtists.map((a) => a.groupLetter))];
  const myStandings: Record<string, ReturnType<typeof computeStandings>> = {};
  for (const letter of groupLetters) {
    const groupArtists = await prisma.copaArtist.findMany({
      where: { copaId: copa.id, groupLetter: letter },
      select: { id: true },
    });
    const groupFixtures = await prisma.copaFixture.findMany({
      where: { copaId: copa.id, groupLetter: letter, phase: "GROUP" },
      include: { votes: true },
    });
    myStandings[letter] = computeStandings(
      groupFixtures,
      groupArtists.map((a) => a.id),
    );
  }

  function collectSongIds(f: NonNullable<typeof liveFixture>) {
    const singlesA = [...f.artistA.singles].sort((a, b) => a.slotIndex - b.slotIndex);
    const singlesB = [...f.artistB.singles].sort((a, b) => a.slotIndex - b.slotIndex);
    return [singlesA[f.singleAIdx]?.songId, singlesB[f.singleBIdx]?.songId];
  }

  const coverMap = await resolveSongCoverUrls([
    ...(liveFixture ? collectSongIds(liveFixture) : []),
    ...recentDone.flatMap((f) => collectSongIds(f)),
    ...(upcoming ? collectSongIds({ ...upcoming, votes: [] }) : []),
  ]);

  function serializeFixture(f: typeof liveFixture) {
    if (!f) return null;
    const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
    const myVote = userId ? (f.votes.find((v) => v.userId === userId)?.side ?? null) : null;
    const singlesA = [...f.artistA.singles].sort((a, b) => a.slotIndex - b.slotIndex);
    const singlesB = [...f.artistB.singles].sort((a, b) => a.slotIndex - b.slotIndex);
    const singleASongId = singlesA[f.singleAIdx]?.songId ?? null;
    const singleBSongId = singlesB[f.singleBIdx]?.songId ?? null;
    return {
      id: f.id,
      copaId: f.copaId,
      phase: f.phase as string,
      groupLetter: f.groupLetter,
      round: f.round,
      matchIndex: f.matchIndex,
      status: f.status as string,
      votesA,
      votesB,
      goalsA,
      goalsB,
      myVote: myVote as "A" | "B" | null,
      singleAIdx: f.singleAIdx,
      singleBIdx: f.singleBIdx,
      singleAName: singlesA[f.singleAIdx]?.songName ?? "",
      singleBName: singlesB[f.singleBIdx]?.songName ?? "",
      singleACover: pickSingleCover(singleASongId, coverMap),
      singleBCover: pickSingleCover(singleBSongId, coverMap),
      artistA: {
        id: f.artistA.id,
        artistName: f.artistA.artistName,
        artistImage: f.artistA.artistImage,
        artistColor: f.artistA.artistColor,
        artistInitials: f.artistA.artistInitials,
        ownerId: f.artistA.ownerId,
        groupLetter: f.artistA.groupLetter,
      },
      artistB: {
        id: f.artistB.id,
        artistName: f.artistB.artistName,
        artistImage: f.artistB.artistImage,
        artistColor: f.artistB.artistColor,
        artistInitials: f.artistB.artistInitials,
        ownerId: f.artistB.ownerId,
        groupLetter: f.artistB.groupLetter,
      },
    };
  }

  return (
    <CopaHomeClient
      copa={{
        id: copa.id,
        name: copa.name,
        year: copa.year,
        status: copa.status as string,
        maxParticipants: copa.maxParticipants,
        isParticipant: userId ? copa.participants.some((p) => p.userId === userId) : false,
        participants: copa.participants.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          handle: p.user.handle,
          avatarColor: p.user.avatarColor,
        })),
      }}
      userId={userId}
      liveFixture={serializeFixture(liveFixture)}
      recentDone={recentDone.map((f) => serializeFixture(f)!)}
      upcoming={upcoming ? serializeFixture({ ...upcoming, votes: [] })! : null}
      myArtists={myArtists.map((a) => ({
        id: a.id,
        artistName: a.artistName,
        artistImage: a.artistImage,
        artistColor: a.artistColor,
        artistInitials: a.artistInitials,
        groupLetter: a.groupLetter,
        standingRank: myStandings[a.groupLetter]?.findIndex((r) => r.artistId === a.id) ?? -1,
      }))}
    />
  );
}
