import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getVoteCounts, fixtureBatchOrder, pickSingleCover, resolveSongCoverUrls } from "@/lib/copa";
import { youtubePlaylistUrl } from "@/lib/youtube-user";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { LiveClient } from "./LiveClient";

export const dynamic = "force-dynamic";

export default async function CopaAoVivoPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const { t } = await getServerTranslations();

  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!copa) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        {t("copa.noActiveCopa")}
      </div>
    );
  }

  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, status: "LIVE" },
    include: {
      votes: true,
      artistA: { include: { singles: { select: { slotIndex: true, songName: true, songId: true } } } },
      artistB: { include: { singles: { select: { slotIndex: true, songName: true, songId: true } } } },
    },
    orderBy: [{ phase: "asc" }, { groupLetter: "asc" }, { matchIndex: "asc" }],
  });

  const coverMap = await resolveSongCoverUrls(
    fixtures.flatMap((f) => {
      const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
      const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
      return [sA?.songId, sB?.songId];
    }),
  );

  const games = fixtures.map((f) => {
    const { votesA, votesB, goalsA, goalsB } = getVoteCounts(f, copa.votesPerGoal);
    // Jogo Ao vivo → single em disputa é revelado.
    const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
    const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
    return {
      id: f.id,
      phase: f.phase as string,
      groupLetter: f.groupLetter,
      round: f.round,
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
  });

  // Playlists do dia: o lote ao vivo compartilha o mesmo batchOrder.
  const batchOrder = fixtures.length > 0 ? fixtureBatchOrder(fixtures[0]) : null;
  const dayPlaylist =
    batchOrder != null
      ? await prisma.copaDayPlaylist.findUnique({
          where: { copaId_batchOrder: { copaId: copa.id, batchOrder } },
        })
      : null;

  const playlists =
    dayPlaylist && (dayPlaylist.spotifyPlaylistId || dayPlaylist.youtubePlaylistId)
      ? {
          dayLabel: dayPlaylist.dayLabel,
          spotifyUrl: dayPlaylist.spotifyPlaylistId
            ? `https://open.spotify.com/playlist/${dayPlaylist.spotifyPlaylistId}`
            : null,
          youtubeUrl: dayPlaylist.youtubePlaylistId
            ? youtubePlaylistUrl(dayPlaylist.youtubePlaylistId)
            : null,
        }
      : null;

  return <LiveClient games={games} playlists={playlists} copaId={copa.id} batchOrder={batchOrder} userId={userId} />;
}
