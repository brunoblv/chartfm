import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
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
import { TimelineTabs, type ReviewItem } from "@/components/home/TimelineTabs";
import type { UserWithCharts } from "@/lib/types";

export const metadata: Metadata = {
  title: "ChartFM — Sua parada musical semanal",
  description: "Crie sua parada musical semanal, descubra novos artistas e participe de comunidades no ChartFM. Rankings, reviews e curadoria musical feitos por fãs.",
  alternates: { canonical: "/" },
};

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
  followingIds: Set<string>,
): Promise<PublisherRow[]> {
  const charts = await prisma.chart.findMany({
    where: { userId: { not: userId }, isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: 15,
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
    take: 60,
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
          paradaNome: true,
          paradaLogo: true,
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

  const friendsRows = rows.filter((r) => followingIds.has(r.user.id)).slice(0, 15);
  const allRows = rows.filter((r) => !followingIds.has(r.user.id)).slice(0, 15);
  const combined = [...friendsRows, ...allRows];

  const likedRows = await prisma.chartLike.findMany({
    where: { userId, chartId: { in: combined.map((c) => c.id) } },
    select: { chartId: true },
  });
  const likedSet = new Set(likedRows.map((r) => r.chartId));

  return {
    friendsFeed: friendsRows.map((c) => mapChartRow(c, followingIds, likedSet)),
    allFeed: allRows.map((c) => mapChartRow(c, followingIds, likedSet)),
  };
}

function mapChartRow(
  c: {
    id: string; weekLabel: string; dateRange: string; weekIndex: number;
    publishedAt: Date; likes: number; comments: number; reposts: number;
    user: {
      id: string; handle: string; name: string; avatarColor: string; image: string | null;
      followers: number; verified: boolean; streak: number; bio: string | null;
      following: number; paradaNome: string | null; paradaLogo: string | null;
    };
    entries: {
      position: number; status: string; delta: number | null; prevPos: number | null;
      peak: number; weeks: number; coverPaletteA: string; coverPaletteB: string; coverSeed: number;
      song: {
        id: string; title: string; artist: string; album: string | null;
        albumRef: { id: number; coverUrl: string | null } | null;
        spotifyId: string | null; artistSpotifyId: string | null;
        artistRef: { id: number; name: string } | null;
      };
    }[];
  },
  followingIds: Set<string>,
  likedSet: Set<string>,
) {
  return {
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
      paradaNome: c.user.paradaNome,
      paradaLogo: c.user.paradaLogo,
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
    isLiked: likedSet.has(c.id),
  };
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const rankingWeek = getRankingWeekReference(nowBRT);
    const [globalChart, userCount, recentUsers] = await Promise.all([
      getGlobalTopSongs(rankingWeek.weekIndex, 8),
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, avatarColor: true, image: true },
      }),
    ]);
    return <LandingPage globalChart={globalChart} userCount={userCount} recentUsers={recentUsers} />;
  }

  let userStreak = 0;
  let userParadaNome: string | null = null;
  let thisWeekChartId: string | null = null;
  let userGenres: string[] = [];
  let followingIds = new Set<string>();

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const currentWeekIdx = buildWeekIndexFromDate(nowBRT);
  const rankingWeek = getRankingWeekReference();

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

  const [daysLeft, trendingArtists, globalTopSongs, suggestedUsers, timelineFeeds, publishedToday, reviewsFeed] =
    await Promise.all([
      Promise.resolve(daysUntilSundayBRT()),
      getTrendingArtists(rankingWeek.weekIndex),
      getGlobalTopSongs(rankingWeek.weekIndex, 3),
      getSuggestedUsers(session.user.id, userGenres, 3),
      getTimelineFeed(session.user.id, currentWeekIdx, followingIds),
      getPublishedThisWeek(session.user.id, followingIds),
      getReviewsFeed(session.user.id),
    ]);
  const { friendsFeed, allFeed } = timelineFeeds;

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <YourWeekCard streak={userStreak} daysLeft={daysLeft} paradaNome={userParadaNome} thisWeekChartId={thisWeekChartId} />

      {publishedToday.length > 0 && <FriendsRow publishers={publishedToday} />}

      <TimelineTabs friendsFeed={friendsFeed} allFeed={allFeed} reviewsFeed={reviewsFeed} />
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
      background: "var(--gradient-hero)",
      borderRadius: 18,
      padding: 24,
      color: "white",
      display: "flex",
      alignItems: "center",
      gap: 20,
      boxShadow: "var(--shadow-hero)",
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
        background: "white", color: "var(--accent)", textDecoration: "none",
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Últimas paradas</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{publishers.length} pessoas</div>
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingTop: 4, paddingBottom: 4, paddingLeft: 4 }}>
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
                background: "var(--accent)", color: "white",
                fontSize: 10, fontWeight: 700,
                padding: "2px 6px", borderRadius: 8,
                border: "2px solid var(--surface)",
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)", display: "grid", placeItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>Parada Global</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{weekLabel}</div>
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
              <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{e.song.artist}</Link>
            </div>
          </div>
        ))}
      </div>
      <Link href="/global" style={{ marginTop: 14, fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
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
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.handle} · {u.followers.toLocaleString("pt-BR")} seguidores</div>
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

async function getReviewsFeed(userId: string): Promise<ReviewItem[]> {
  const rows = await prisma.albumReview.findMany({
    where: { userId: { not: userId } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          verified: true,
        },
      },
      album: {
        select: {
          id: true,
          title: true,
          exhibitionName: true,
          coverUrl: true,
          artist: {
            select: { id: true, name: true, exhibitionName: true },
          },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    postedAgo: formatRelativeTime(r.createdAt),
    user: {
      id: r.user.id,
      handle: r.user.handle,
      name: r.user.name,
      avatar: r.user.avatarColor,
      imageUrl: r.user.image ?? null,
      verified: r.user.verified,
    },
    album: {
      id: r.album.id,
      artistId: r.album.artist.id,
      title: r.album.exhibitionName || r.album.title,
      coverUrl: r.album.coverUrl ?? null,
      artistName: r.album.artist.exhibitionName || r.album.artist.name,
    },
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>Artistas em alta</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{weekLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {artists.map((a, i) => (
          <Link key={a.name} href={buildArtistPath(a.name)} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", width: 20, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
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
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.chartCount} paradas · {a.totalPoints}pts</div>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/global" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
        Ver parada completa →
      </Link>
    </div>
  );
}
