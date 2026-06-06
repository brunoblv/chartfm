import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug, buildAlbumPath, buildArtistPath } from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { formatChartPeriod } from "@/lib/chart-week";
import { SongAppearancesTabs } from "@/components/song/SongAppearancesTabs";
import { getDailyChartSongStatsForPages } from "@/lib/daily-chart-song-stats";
import { globalStatsForSingleSong, pointsForPosition, songKey } from "@/lib/chart-page-common";
import { songEntityKey } from "@/lib/entity-page-snapshot/keys";
import { getLatestEntityPageSnapshot } from "@/lib/entity-page-snapshot/store";
import type { SongPageSnapshotPayload } from "@/lib/entity-page-snapshot/types";

/** Apenas o intervalo de datas (sem o sufixo "Semana …"). */
function chartDateRangeOnly(chart: { weekLabel: string; dateRange: string }): string {
  const full = formatChartPeriod(chart);
  const marker = " - ";
  const cut = full.lastIndexOf(marker);
  return cut >= 0 ? full.slice(0, cut) : full;
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    : null;
  const canEditSong = isPrivilegedRole(me?.role);
  const { slug } = await params;
  const parsed = parseSongSlug(slug);
  if (!parsed) {
    return (
      <Shell title="Música" subtitle="Não encontrada">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos essa música.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) {
    return (
      <Shell title="Música" subtitle="Não encontrada">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para essa música.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const cachedSnapshot = await getLatestEntityPageSnapshot<SongPageSnapshotPayload>(
    "SONG",
    songEntityKey(songId),
  );

  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      songId,
    },
    select: {
      position: true,
      points: true,
      status: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          id: true,
          weekIndex: true,
          userId: true,
          weekLabel: true,
          dateRange: true,
        },
      },
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          albumRef: { select: { id: true, coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const songRow =
    entries[0]?.song ??
    (await prisma.song.findUnique({
      where: { id: songId },
      select: {
        title: true,
        artist: true,
        album: true,
        albumRef: { select: { id: true, coverUrl: true } },
        spotifyId: true,
        artistSpotifyId: true,
        artistRef: { select: { id: true } },
      },
    }));

  if (!songRow) {
    return (
      <Shell title="Música" subtitle="Não encontrada">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para essa música.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const first = entries[0];
  let title = songRow.title;
  let artist = songRow.artist;
  let album = songRow.album ?? "";
  let spotifyId = songRow.spotifyId;
  let artistSpotifyId = songRow.artistSpotifyId;
  let artistDbId = songRow.artistRef?.id ?? null;
  let albumDbId = songRow.albumRef?.id ?? null;
  let coverImageUrl = songRow.albumRef?.coverUrl?.trim() || null;
  let paletteA = first?.coverPaletteA ?? "#FA243C";
  let paletteB = first?.coverPaletteB ?? "#FFE66D";
  let coverSeed = first?.coverSeed ?? 0;
  let hasChartPresence = entries.length > 0;
  let chartEntries = entries.length;
  let topUsers: SongPageSnapshotPayload["topUsers"] = [];
  let globalStats: SongPageSnapshotPayload["globalStats"];

  if (cachedSnapshot) {
    const p = cachedSnapshot.payload;
    title = p.title;
    artist = p.artist;
    album = p.album;
    spotifyId = p.spotifyId;
    artistSpotifyId = p.artistSpotifyId;
    artistDbId = p.artistDbId;
    albumDbId = p.albumDbId;
    coverImageUrl = p.coverImageUrl;
    paletteA = p.paletteA;
    paletteB = p.paletteB;
    coverSeed = p.coverSeed;
    hasChartPresence = p.hasChartPresence;
    chartEntries = p.chartEntries;
    topUsers = p.topUsers;
    globalStats = p.globalStats;
  } else {
    const totalPoints = entries.reduce(
      (sum, e) => sum + (e.points > 0 ? e.points : pointsForPosition(e.position)),
      0,
    );
    const users = new Set(entries.map((e) => e.chart.userId)).size;
    const topUsersMap = new Map<string, { points: number }>();
    for (const e of entries) {
      const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
      const current = topUsersMap.get(e.chart.userId) ?? { points: 0 };
      current.points += pts;
      topUsersMap.set(e.chart.userId, current);
    }
    const topUsersIds = [...topUsersMap.keys()];
    const topUsersRows = topUsersIds.length
      ? await prisma.user.findMany({
          where: { id: { in: topUsersIds } },
          select: { id: true, handle: true, name: true, avatarColor: true, image: true },
        })
      : [];
    const topUsersById = new Map(topUsersRows.map((u) => [u.id, u]));
    topUsers = [...topUsersMap.entries()]
      .map(([userId, row]) => {
        const user = topUsersById.get(userId);
        if (!user) return null;
        return { user, points: row.points };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    const dailyStats = await getDailyChartSongStatsForPages();
    const gs = globalStatsForSingleSong(songKey(title, artist), dailyStats.weeklyBuckets);
    globalStats = {
      totalPoints,
      uniqueUsers: users,
      weeksTop100: gs.weeks,
      number1s: gs.number1s,
      peak: gs.peak,
    };
  }

  const currentUserId = session?.user?.id ?? null;
  const myEntries = currentUserId ? entries.filter((e) => e.chart.userId === currentUserId) : [];

  const myVideoClip = currentUserId
    ? await prisma.userSongVideoClipChoice.findUnique({
        where: { userId_songId: { userId: currentUserId, songId } },
        select: { clipId: true, clip: { select: { imageUrl: true } } },
      })
    : null;

  const [allClips, myVotes] = await Promise.all([
    prisma.songVideoClip.findMany({
      where: { songId },
      orderBy: { votes: "desc" },
      select: {
        id: true,
        imageUrl: true,
        votes: true,
        uploadedBy: true,
        uploader: { select: { name: true, handle: true } },
      },
    }),
    currentUserId
      ? prisma.songVideoClipVote.findMany({
          where: { userId: currentUserId, clip: { songId } },
          select: { clipId: true },
        })
      : Promise.resolve([]),
  ]);

  const votedIds = new Set(myVotes.map((v) => v.clipId));

  const initialClips = allClips.map((c) => ({
    id: c.id,
    imageUrl: c.imageUrl,
    votes: c.votes,
    uploadedBy: c.uploadedBy,
    uploaderName: c.uploader.name,
    uploaderHandle: c.uploader.handle,
    hasVoted: votedIds.has(c.id),
    isMyChoice: myVideoClip?.clipId === c.id,
    isMyUpload: c.uploadedBy === currentUserId,
  }));

  const myAppearancesSorted = [...myEntries]
    .sort((a, b) => a.chart.weekIndex - b.chart.weekIndex)
    .map((e) => ({
      chartId: e.chart.id,
      position: e.position,
      dateRange: chartDateRangeOnly({ weekLabel: e.chart.weekLabel, dateRange: e.chart.dateRange }),
      weekOfYear: e.chart.weekIndex % 100,
      year: Math.floor(e.chart.weekIndex / 100),
    }));

  const myStats = {
    appearances: myEntries.length,
    bestPosition: myEntries.length > 0 ? Math.min(...myEntries.map((e) => e.position)) : 9999,
    points: myEntries.reduce((sum, e) => sum + (e.points > 0 ? e.points : pointsForPosition(e.position)), 0),
    number1s: myEntries.filter((e) => e.position === 1).length,
  };

  return (
    <Shell title="" noPadding>
      <div style={{ padding: "48px 40px 40px 40px" }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 24 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Cover
            cover={{
              palette: [paletteA, paletteB],
              seed: coverSeed,
              imageUrl: coverImageUrl,
            }}
            song={{
              title,
              artist,
              album,
              spotifyId: spotifyId ?? undefined,
              imageUrl: coverImageUrl,
            }}
            size={180}
            rounded={14}
          />
          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>{title}</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <Link href={buildArtistPath(artist, artistSpotifyId, artistDbId)} style={{ display: "block", fontSize: 16, fontWeight: 600, color: "var(--text)", textDecoration: "none", lineHeight: 1.35 }}>
                {artist}
              </Link>
              {album.trim() ? (
                <Link
                  href={buildAlbumPath(album.trim(), artist, { artistId: artistDbId, albumId: albumDbId })}
                  style={{ display: "block", fontSize: 14, color: "#86868B", textDecoration: "none", lineHeight: 1.35 }}
                >
                  {album}
                </Link>
              ) : null}
            </div>
            {canEditSong && (
              <div style={{ marginTop: 10 }}>
                <Link href={`/song/${slug}/edit`} style={{ fontSize: 13, fontWeight: 700, color: "#FA243C", textDecoration: "none" }}>
                  Editar música
                </Link>
              </div>
            )}
          </div>
        </div>

        <SongAppearancesTabs
          currentUserId={currentUserId}
          songId={songId}
          myAppearances={myAppearancesSorted}
          myStats={myStats}
          globalStats={globalStats}
          topUsers={topUsers}
          initialVideoClipUrl={myVideoClip?.clip?.imageUrl ?? null}
          initialClips={initialClips}
        />

        {!hasChartPresence && (
          <div style={{ marginTop: 20, padding: 14, background: "var(--fill-inset)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)" }}>
            Esta faixa ainda não aparece em nenhuma parada publicada. Os números abaixo ficam zerados até alguém votar com ela.
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 13, color: "#86868B" }}>
          Entradas em paradas de usuários: {chartEntries}
        </div>
      </div>
    </Shell>
  );
}
