import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { GroupsClient } from "./GroupsClient";
import { computeStandings, getVoteCounts, COPA_GROUP_LETTERS } from "@/lib/copa";

export const revalidate = 10;

export default async function CopaGruposPage() {
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

  const artists = await prisma.copaArtist.findMany({
    where: { copaId: copa.id },
    include: {
      owner: { select: { id: true, name: true, handle: true, avatarColor: true } },
      singles: { select: { slotIndex: true, songName: true, songId: true } },
    },
    orderBy: [{ groupLetter: "asc" }, { slotInGroup: "asc" }],
  });

  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, phase: "GROUP" },
    include: { votes: true },
    orderBy: [{ groupLetter: "asc" }, { round: "asc" }, { matchIndex: "asc" }],
  });

  // Build group data
  const groups = COPA_GROUP_LETTERS.map((letter) => {
    const groupArtists = artists.filter((a) => a.groupLetter === letter);
    const groupFixtures = fixtures.filter((f) => f.groupLetter === letter);
    const standings = computeStandings(
      groupFixtures,
      groupArtists.map((a) => a.id),
    );

    return {
      letter,
      artists: groupArtists.map((a) => ({
        id: a.id,
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
      })),
      standings,
      fixtures: groupFixtures.map((f) => {
        const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
        return {
          id: f.id,
          round: f.round,
          matchIndex: f.matchIndex,
          artistAId: f.artistAId,
          artistBId: f.artistBId,
          singleAIdx: f.singleAIdx,
          singleBIdx: f.singleBIdx,
          votesA,
          votesB,
          goalsA,
          goalsB,
          status: f.status as string,
        };
      }),
    };
  }).filter((g) => g.artists.length > 0);

  return <GroupsClient groups={groups} userId={userId} copaId={copa.id} />;
}
