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

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

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
  const title = songRow.title;
  const artist = songRow.artist;
  const album = songRow.album ?? "";
  const spotifyId = songRow.spotifyId;
  const artistSpotifyId = songRow.artistSpotifyId;
  const artistDbId = songRow.artistRef?.id ?? null;
  const albumDbId = songRow.albumRef?.id ?? null;
  const coverImageUrl = songRow.albumRef?.coverUrl?.trim() || null;
  const paletteA = first?.coverPaletteA ?? "#FA243C";
  const paletteB = first?.coverPaletteB ?? "#FFE66D";
  const coverSeed = first?.coverSeed ?? 0;
  const totalPoints = entries.reduce((sum, e) => sum + (e.points > 0 ? e.points : pointsForPosition(e.position)), 0);
  const hasChartPresence = entries.length > 0;
  const users = new Set(entries.map((e) => e.chart.userId)).size;
  const chartEntries = entries.length;
  const topUsersMap = new Map<
    string,
    {
      user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
      points: number;
    }
  >();
  for (const e of entries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const current = topUsersMap.get(e.chart.userId) ?? {
      user: {
        id: e.chart.userId,
        handle: "",
        name: "",
        avatarColor: "#FA243C",
        image: null,
      },
      points: 0,
    };
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
  const topUsers = [...topUsersMap.entries()]
    .map(([userId, row]) => {
      const user = topUsersById.get(userId);
      if (!user) return null;
      return { user, points: row.points };
    })
    .filter((row): row is { user: NonNullable<typeof topUsersRows[number]>; points: number } => Boolean(row))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const globalRows = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { title: true, artist: true } },
    },
  });
  const targetKey = songKey(title, artist);
  const weeklyBuckets = new Map<number, Map<string, number>>();
  for (const row of globalRows) {
    const wk = row.chart.weekIndex;
    const key = songKey(row.song.title, row.song.artist);
    const pts = row.points > 0 ? row.points : pointsForPosition(row.position);
    const bySong = weeklyBuckets.get(wk) ?? new Map<string, number>();
    bySong.set(key, (bySong.get(key) ?? 0) + pts);
    weeklyBuckets.set(wk, bySong);
  }
  let weeksTop100 = 0;
  let peak = 9999;
  let number1s = 0;
  for (const [, bySong] of weeklyBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    const idx = top100.findIndex(([k]) => k === targetKey);
    if (idx >= 0) {
      const pos = idx + 1;
      weeksTop100 += 1;
      peak = Math.min(peak, pos);
      if (pos === 1) number1s += 1;
    }
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
          globalStats={{ totalPoints, uniqueUsers: users, weeksTop100, number1s, peak }}
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
