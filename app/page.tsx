import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
import { ChartCard } from "@/components/chart/ChartCard";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { FollowButton } from "@/components/ui/FollowButton";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { COVER_PALETTES } from "@/lib/data";
import { buildWeekIndexFromDate, buildWeekLabelFromDate, getRankingWeekReference } from "@/lib/chart-week";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { LandingPage } from "@/components/landing/LandingPage";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import type { UserWithCharts } from "@/lib/types";

function daysUntilSundayBRT(): number {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const day = nowBRT.getUTCDay();
  return day === 0 ? 0 : 7 - day;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "há 1d";
  return `há ${diffDays}d`;
}

type PublisherRow = {
  userId: string;
  chartId: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
  entryCount: number;
};

async function getPublishedThisWeek(
  userId: string,
  weekIdx: number,
  followingIds: Set<string>,
): Promise<PublisherRow[]> {
  const charts = await prisma.chart.findMany({
    where: { userId: { not: userId }, weekIndex: weekIdx, isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: 14,
    select: {
      id: true,
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
      _count: { select: { entries: true } },
    },
  });

  return charts
    .sort((a, b) => {
      const aF = followingIds.has(a.user.id) ? 1 : 0;
      const bF = followingIds.has(b.user.id) ? 1 : 0;
      return bF - aF;
    })
    .map((c) => ({
      userId: c.user.id,
      chartId: c.id,
      handle: c.user.handle,
      name: c.user.name,
      avatarColor: c.user.avatarColor,
      image: c.user.image,
      entryCount: c._count.entries,
    }));
}

async function getTimelineFeed(
  userId: string,
  weekIdx: number,
  followingIds: Set<string>,
) {
  const rows = await prisma.chart.findMany({
    where: {
      userId: { not: userId },
      weekIndex: { gte: weekIdx - 2 },
      isPublished: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: {
      id: true,
      weekLabel: true,
      dateRange: true,
      weekIndex: true,
      publishedAt: true,
      likes: true,
      comments: true,
      reposts: true,
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          followers: true,
          verified: true,
          streak: true,
          bio: true,
          following: true,
        },
      },
      entries: {
        orderBy: { position: "asc" },
        take: 20,
        select: {
          position: true,
          status: true,
          delta: true,
          prevPos: true,
          peak: true,
          weeks: true,
          coverPaletteA: true,
          coverPaletteB: true,
          coverSeed: true,
          song: {
            select: {
              id: true,
              title: true,
              artist: true,
              album: true,
              albumRef: { select: { id: true, coverUrl: true } },
              spotifyId: true,
              artistSpotifyId: true,
              artistRef: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  rows.sort((a, b) => {
    const aF = followingIds.has(a.user.id) ? 1 : 0;
    const bF = followingIds.has(b.user.id) ? 1 : 0;
    if (aF !== bF) return bF - aF;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  return rows.slice(0, 15).map((c) => ({
    user: {
      id: c.user.id,
      handle: c.user.handle,
      name: c.user.name,
      avatar: c.user.avatarColor,
      imageUrl: c.user.image,
      bio: c.user.bio ?? "",
      followers: c.user.followers,
      following: c.user.following,
      streak: c.user.streak,
      verified: c.user.verified,
      charts: [],
    } as UserWithCharts,
    chart: {
      id: c.id,
      week: c.weekIndex,
      weekLabel: c.weekLabel,
      dateRange: c.dateRange,
      likes: c.likes,
      comments: c.comments,
      reposts: c.reposts,
      entries: c.entries.map((e) => ({
        position: e.position,
        status: e.status as "new" | "return" | "up" | "down" | "same",
        delta: e.delta,
        prevPos: e.prevPos,
        peak: e.peak,
        weeks: e.weeks,
        cover: {
          palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
          seed: e.coverSeed,
          imageUrl: e.song.albumRef?.coverUrl?.trim() || null,
        },
        song: {
          id: e.song.id,
          title: e.song.title,
          artist: e.song.artistRef?.name?.trim() || e.song.artist,
          slugArtist: e.song.artist,
          album: e.song.album ?? "",
          spotifyId: e.song.spotifyId ?? null,
          artistSpotifyId: e.song.artistSpotifyId ?? null,
          artistRefId: e.song.artistRef?.id ?? null,
          albumRefId: e.song.albumRef?.id ?? null,
          imageUrl: e.song.albumRef?.coverUrl?.trim() || null,
        },
      })),
    },
    postedAgo: formatRelativeTime(c.publishedAt),
    isFollowing: followingIds.has(c.user.id),
  }));
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const rankingWeek = getRankingWeekReference(nowBRT);
    const globalChart = await getGlobalTopSongs(rankingWeek.weekIndex, 8);
    return <LandingPage globalChart={globalChart} />;
  }

  let userStreak = 0;
  let userParadaNome: string | null = null;
  let thisWeekChartId: string | null = null;
  let userGenres: string[] = [];
  let followingIds = new Set<string>();

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const currentWeekIdx = buildWeekIndexFromDate(nowBRT);
  const rankingWeek = getRankingWeekReference(nowBRT);

  if (session?.user?.id) {
    const [user, thisWeekChart, followRows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { streak: true, paradaNome: true, genres: true },
      }),
      prisma.chart.findUnique({
        where: { userId_weekIndex: { userId: session.user.id, weekIndex: currentWeekIdx } },
        select: { id: true },
      }),
      prisma.userFollow.findMany({
        where: { followerId: session.user.id },
        select: { followingId: true },
      }),
    ]);

    if (user && !user.genres?.length) redirect("/onboarding");

    userStreak = user?.streak ?? 0;
    userParadaNome = user?.paradaNome ?? null;
    userGenres = user?.genres ?? [];
    thisWeekChartId = thisWeekChart?.id ?? null;
    followingIds = new Set(followRows.map((r) => r.followingId));
  }

  const [daysLeft, trendingArtists, globalTopSongs, suggestedUsers, timelineFeed, publishedToday] =
    await Promise.all([
      Promise.resolve(daysUntilSundayBRT()),
      getTrendingArtists(rankingWeek.weekIndex),
      getGlobalTopSongs(rankingWeek.weekIndex, 3),
      getSuggestedUsers(session.user.id, userGenres, 3),
      getTimelineFeed(session.user.id, currentWeekIdx, followingIds),
      getPublishedThisWeek(session.user.id, currentWeekIdx, followingIds),
    ]);

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <YourWeekCard streak={userStreak} daysLeft={daysLeft} paradaNome={userParadaNome} thisWeekChartId={thisWeekChartId} />

      {publishedToday.length > 0 && <FriendsRow publishers={publishedToday} />}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 2px 0 2px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase" }}>Timeline</div>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
        <button style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#FA243C", cursor: "pointer" }}>Filtrar</button>
      </div>

      {timelineFeed.length > 0 ? (
        timelineFeed.map((t) => (
          <ChartCard key={t.chart.id} user={t.user} chart={t.chart} postedAgo={t.postedAgo} isFollowing={t.isFollowing} />
        ))
      ) : (
        <div style={{
          background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma parada por aqui ainda</div>
          <div style={{ fontSize: 13, color: "#86868B" }}>Siga mais pessoas para ver as paradas delas aqui</div>
        </div>
      )}
    </div>
  );

  const sidebar = (
    <>
      <GlobalTeaser topSongs={globalTopSongs} weekLabel={rankingWeek.weekLabel} />
      <SuggestedUsers users={suggestedUsers.map((u) => ({ ...u, isFollowing: followingIds.has(u.id) }))} />
      <TrendingArtists artists={trendingArtists} weekLabel={rankingWeek.weekLabel} />
    </>
  );

  return (
    <Shell title="Início" subtitle="As paradas de quem você segue, atualizadas em tempo real">
      <HomeGrid feed={feed} sidebar={sidebar} />
    </Shell>
  );
}

function YourWeekCard({
  streak,
  daysLeft,
  paradaNome,
  thisWeekChartId,
}: {
  streak: number;
  daysLeft: number;
  paradaNome: string | null;
  thisWeekChartId: string | null;
}) {
  const weekNow = buildWeekLabelFromDate(new Date());
  const hasSubmitted = thisWeekChartId !== null;
  const label = paradaNome ? paradaNome.toUpperCase() : "SUA PARADA";
  return (
    <div style={{
      background: "linear-gradient(135deg, #FA243C 0%, #FF5858 100%)",
      borderRadius: 18,
      padding: 24,
      color: "white",
      display: "flex",
      alignItems: "center",
      gap: 20,
      boxShadow: "0 4px 16px rgba(250,36,60,0.25)",
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(255,255,255,0.15)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
          {label} · {weekNow}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 2, lineHeight: 1.2 }}>
          {hasSubmitted ? "Você já publicou esta semana!" : "Quais foram suas músicas dessa semana?"}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {hasSubmitted ? (
            "Clique para ver sua parada"
          ) : (
            <>
              {daysLeft === 0 ? "Último dia" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`}
              {streak > 0 && <> · sequência ativa <Flame size={12} fill="white" /></>}
            </>
          )}
        </div>
      </div>
      <Link href={hasSubmitted ? `/chart/${thisWeekChartId}` : "/create"} style={{
        background: "white", color: "#FA243C", textDecoration: "none",
        padding: "12px 22px", borderRadius: 100, fontSize: 14, fontWeight: 700,
        letterSpacing: "-0.01em", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {hasSubmitted ? "Ver minha parada" : "Criar parada"}
      </Link>
    </div>
  );
}

function FriendsRow({ publishers }: { publishers: PublisherRow[] }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Publicaram hoje</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "#86868B" }}>{publishers.length} pessoas</div>
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>
        {publishers.map((p) => (
          <Link
            key={p.userId}
            href={`/profile/${p.handle}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", flexShrink: 0 }}
          >
            <div style={{ position: "relative" }}>
              <Avatar
                user={{ name: p.name, avatar: p.avatarColor }}
                imageUrl={p.image}
                size={56}
                ring
              />
              <div style={{
                position: "absolute", bottom: -2, right: -2,
                background: "#FA243C", color: "white",
                fontSize: 10, fontWeight: 700,
                padding: "2px 6px", borderRadius: 8,
                border: "2px solid white",
              }}>
                {p.entryCount}
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500,
              maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", textAlign: "center",
            }}>
              {p.name.split(" ")[0]}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GlobalTeaser({
  topSongs,
  weekLabel,
}: {
  topSongs: Awaited<ReturnType<typeof getGlobalTopSongs>>;
  weekLabel: string;
}) {
  const top3 = topSongs.slice(0, 3);
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "#000", color: "white", display: "grid", placeItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>Parada Global</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "#86868B" }}>{weekLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top3.map((e) => (
          <div key={e.position} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PositionNumber n={e.position} size={14} />
            <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
              <Cover cover={e.cover} song={e.song} size={36} rounded={6} />
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>{e.song.title}</Link>
              <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: 11, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{e.song.artist}</Link>
            </div>
          </div>
        ))}
      </div>
      <Link href="/global" style={{ marginTop: 14, fontSize: 12, color: "#FA243C", fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
        Ver parada completa →
      </Link>
    </div>
  );
}

type SuggestedUserRow = {
  id: string;
  handle: string;
  name: string;
  followers: number;
  avatarColor: string;
  commonGenres: number;
  isFollowing?: boolean;
};

function SuggestedUsers({ users }: { users: SuggestedUserRow[] }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 14 }}>Quem seguir</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {users.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={`/profile/${u.handle}`}>
              <Avatar user={{ name: u.name, avatar: u.avatarColor }} size={40} />
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={`/profile/${u.handle}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#86868B" }}>@{u.handle} · {u.followers.toLocaleString("pt-BR")} seguidores</div>
              </Link>
            </div>
            <FollowButton targetId={u.id} initialFollowing={u.isFollowing} variant="dark" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function getSuggestedUsers(userId: string, genres: string[], limit = 3): Promise<SuggestedUserRow[]> {
  const where = genres.length
    ? { id: { not: userId }, genres: { hasSome: genres } }
    : { id: { not: userId } };
  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, handle: true, name: true, followers: true, avatarColor: true, genres: true },
    orderBy: { followers: "desc" },
    take: 20,
  });
  const ranked = candidates
    .map((u) => ({
      id: u.id,
      handle: u.handle,
      name: u.name,
      followers: u.followers,
      avatarColor: u.avatarColor,
      commonGenres: genres.length ? u.genres.filter((g) => genres.includes(g)).length : 0,
    }))
    .sort((a, b) => {
      if (b.commonGenres !== a.commonGenres) return b.commonGenres - a.commonGenres;
      return b.followers - a.followers;
    })
    .slice(0, limit);

  if (ranked.length >= limit || genres.length === 0) return ranked;

  const fallback = await prisma.user.findMany({
    where: { id: { notIn: [userId, ...ranked.map((r) => r.id)] } },
    select: { id: true, handle: true, name: true, followers: true, avatarColor: true, genres: true },
    orderBy: { followers: "desc" },
    take: limit - ranked.length,
  });
  return [
    ...ranked,
    ...fallback.map((u) => ({
      id: u.id,
      handle: u.handle,
      name: u.name,
      followers: u.followers,
      avatarColor: u.avatarColor,
      commonGenres: genres.length ? u.genres.filter((g) => genres.includes(g)).length : 0,
    })),
  ];
}

async function getTrendingArtists(weekIdx: number, limit = 4) {
  const entries: WeeklyChartEntryRow[] = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx } },
    select: {
      position: true,
      points: true,
      chartId: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          albumRef: { select: { id: true, coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true, spotifyId: true, name: true } },
        },
      },
    },
  });

  const ranked = aggregateTopArtists(entries, limit);
  const spotifyIds = ranked.map((r) => r.spotifyId).filter((id): id is string => Boolean(id));
  const names = ranked.map((r) => r.name);
  const artistRows = (spotifyIds.length || names.length)
    ? await prisma.artist.findMany({
        where: {
          OR: [
            ...(spotifyIds.length ? [{ spotifyId: { in: spotifyIds } }] : []),
            ...(names.length ? [{ name: { in: names } }] : []),
          ],
        },
        select: { spotifyId: true, name: true, imageUrl: true },
      })
    : [];
  const bySpotifyId = new Map(
    artistRows.filter((a) => a.spotifyId).map((a) => [a.spotifyId as string, a.imageUrl]),
  );
  const byName = new Map(artistRows.map((a) => [a.name.toLowerCase(), a.imageUrl]));

  return ranked.map(({ name, totalPoints, chartCount, spotifyId }) => ({
    name,
    totalPoints,
    chartCount,
    imageUrl: (spotifyId ? bySpotifyId.get(spotifyId) : null) ?? byName.get(name.toLowerCase()) ?? null,
  }));
}

async function getGlobalTopSongs(weekIdx: number, limit = 3) {
  const snapshot = await prisma.globalSnapshot.findUnique({ where: { weekIndex: weekIdx } });
  const hasCoverInSlice = (
    rows: Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklySongs"],
  ) => rows.slice(0, limit).some((r) => Boolean(r.cover?.imageUrl));

  if (snapshot) {
    const weeklySongs =
      snapshot.weeklySongs as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklySongs"];
    if (hasCoverInSlice(weeklySongs)) {
      return weeklySongs.slice(0, limit);
    }
    // Fallback para snapshots antigos sem capa persistida.
    // Recalcula ao vivo usando Album.coverUrl.
  }
  const entries: WeeklyChartEntryRow[] = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx } },
    select: {
      position: true,
      points: true,
      chartId: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          albumRef: { select: { id: true, coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true, spotifyId: true, name: true } },
        },
      },
    },
  });
  return aggregateGlobalSongs(entries, limit);
}

function TrendingArtists({
  artists,
  weekLabel,
}: {
  artists: { name: string; totalPoints: number; chartCount: number; imageUrl: string | null }[];
  weekLabel: string;
}) {
  if (artists.length === 0) return null;
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>Artistas em alta</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "#86868B" }}>{weekLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {artists.map((a, i) => (
          <Link key={a.name} href={buildArtistPath(a.name)} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#86868B", width: 20, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: a.imageUrl
                ? `url(${a.imageUrl}) center/cover no-repeat`
                : `linear-gradient(135deg, ${COVER_PALETTES[i * 3][0]}, ${COVER_PALETTES[i * 3][1]})`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              flexShrink: 0,
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "#86868B" }}>{a.chartCount} paradas · {a.totalPoints}pts</div>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/global" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
        Ver parada completa →
      </Link>
    </div>
  );
}
