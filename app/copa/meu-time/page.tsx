import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { MySquadClient } from "./MySquadClient";
import { computeStandings, getCopaSinglesEditWindow, getLockedSingleSlots } from "@/lib/copa";
import { getR32WinnerArtistIds } from "@/lib/copa-knockout";

export const dynamic = "force-dynamic";

export default async function MeuTimePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

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

  const participant = await prisma.copaParticipant.findUnique({
    where: { copaId_userId: { copaId: copa.id, userId: session.user.id } },
  });

  if (!participant) {
    // Registration still open → send them to the home where they can sign up.
    if (copa.status === "REGISTRATION") redirect("/copa");
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Você não é participante desta Copa.
      </div>
    );
  }

  const myArtists = await prisma.copaArtist.findMany({
    where: { copaId: copa.id, ownerId: session.user.id },
    include: { singles: { orderBy: { slotIndex: "asc" } } },
    orderBy: { groupLetter: "asc" },
  });

  // Standings per artist
  const standingsByArtist: Record<string, { rank: number; pts: number; pj: number }> = {};
  const groupLetters = [...new Set(myArtists.map((a) => a.groupLetter))];
  for (const letter of groupLetters) {
    const groupArtists = await prisma.copaArtist.findMany({
      where: { copaId: copa.id, groupLetter: letter },
      select: { id: true },
    });
    const groupFixtures = await prisma.copaFixture.findMany({
      where: { copaId: copa.id, groupLetter: letter, phase: "GROUP" },
      include: { votes: true },
    });
    const standings = computeStandings(groupFixtures, groupArtists.map((a) => a.id), copa.votesPerGoal);
    for (const a of myArtists.filter((a) => a.groupLetter === letter)) {
      const row = standings.find((r) => r.artistId === a.id);
      const rank = standings.findIndex((r) => r.artistId === a.id);
      standingsByArtist[a.id] = { rank, pts: row?.Pts ?? 0, pj: row?.P ?? 0 };
    }
  }

  // All copa artists for the "claim" picker (to see which are taken)
  const allArtists = await prisma.copaArtist.findMany({
    where: { copaId: copa.id },
    select: { artistSpotifyId: true, artistName: true, ownerId: true },
  });

  // Active fixtures for my artists (to know which slots are locked)
  const myArtistIds = myArtists.map((a) => a.id);
  const [activeFixtures, allFixtures] = await Promise.all([
    myArtistIds.length > 0
      ? prisma.copaFixture.findMany({
          where: {
            OR: [{ artistAId: { in: myArtistIds } }, { artistBId: { in: myArtistIds } }],
            status: { in: ["LIVE", "DONE"] },
          },
          select: { artistAId: true, artistBId: true, singleAIdx: true, singleBIdx: true, status: true, phase: true },
        })
      : Promise.resolve([]),
    prisma.copaFixture.findMany({
      where: { copaId: copa.id },
      select: { phase: true, status: true, matchIndex: true },
    }),
  ]);

  const editWindowBase = getCopaSinglesEditWindow(copa.status, allFixtures);
  const r32Winners =
    editWindowBase.nextPhase === "R16" && editWindowBase.open
      ? await getR32WinnerArtistIds(copa.id)
      : null;
  const editWindow =
    r32Winners && r32Winners.length > 0
      ? { ...editWindowBase, competingArtistIds: r32Winners }
      : editWindowBase;

  function getSlotLocks(artistId: string) {
    const artistFixtures = activeFixtures.filter(
      (f) => f.artistAId === artistId || f.artistBId === artistId,
    );
    return getLockedSingleSlots(artistId, artistFixtures);
  }

  return (
    <MySquadClient
      copaId={copa.id}
      copaStatus={copa.status as string}
      copaType={copa.type as string}
      maxArtists={copa.artistsPerUser}
      editWindow={editWindow}
      myArtists={myArtists.map((a) => ({
        id: a.id,
        artistSpotifyId: a.artistSpotifyId,
        artistName: a.artistName,
        artistImage: a.artistImage,
        artistColor: a.artistColor,
        artistInitials: a.artistInitials,
        groupLetter: a.groupLetter,
        standings: standingsByArtist[a.id] ?? { rank: -1, pts: 0, pj: 0 },
        singles: a.singles.map((s) => ({ slotIndex: s.slotIndex, songName: s.songName, songId: s.songId })),
        slotLocks: getSlotLocks(a.id),
      }))}
      takenSpotifyIds={allArtists
        .filter((a) => a.ownerId !== session.user.id && a.artistSpotifyId)
        .map((a) => a.artistSpotifyId as string)}
    />
  );
}
