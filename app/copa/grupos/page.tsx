import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { GroupsClient } from "./GroupsClient";
import { computeStandings, getVoteCounts, COPA_GROUP_LETTERS, pickSingleCover, resolveSongCoverUrls } from "@/lib/copa";

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

  // Single só é revelado no momento do jogo (Ao vivo/Encerrado). A escalação
  // completa nunca vai para o cliente.
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const revealedSingle = (artistId: string, idx: number, status: string) =>
    status === "LIVE" || status === "DONE"
      ? artistById.get(artistId)?.singles.find((s) => s.slotIndex === idx)?.songName ?? ""
      : "";

  const coverMap = await resolveSongCoverUrls(
    fixtures.flatMap((f) => {
      if (f.status !== "LIVE" && f.status !== "DONE") return [];
      const artA = artistById.get(f.artistAId);
      const artB = artistById.get(f.artistBId);
      return [
        artA?.singles.find((s) => s.slotIndex === f.singleAIdx)?.songId,
        artB?.singles.find((s) => s.slotIndex === f.singleBIdx)?.songId,
      ];
    }),
  );

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
      })),
      standings,
      fixtures: groupFixtures.map((f) => {
        const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f);
        const artA = artistById.get(f.artistAId);
        const artB = artistById.get(f.artistBId);
        const singleASongId = artA?.singles.find((s) => s.slotIndex === f.singleAIdx)?.songId;
        const singleBSongId = artB?.singles.find((s) => s.slotIndex === f.singleBIdx)?.songId;
        const revealed = f.status === "LIVE" || f.status === "DONE";
        return {
          id: f.id,
          round: f.round,
          matchIndex: f.matchIndex,
          artistAId: f.artistAId,
          artistBId: f.artistBId,
          singleAName: revealedSingle(f.artistAId, f.singleAIdx, f.status as string),
          singleBName: revealedSingle(f.artistBId, f.singleBIdx, f.status as string),
          singleACover: revealed ? pickSingleCover(singleASongId, coverMap) : null,
          singleBCover: revealed ? pickSingleCover(singleBSongId, coverMap) : null,
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
