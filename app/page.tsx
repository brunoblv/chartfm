import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
import { YourWeekCard } from "@/components/home/YourWeekCard";
import { FriendsRow, GlobalTeaser, SuggestedUsers, TrendingArtists } from "@/components/home/HomeSidebar";
import { formatRelativeTime } from "@/lib/i18n/format";
import { getServerLocale } from "@/lib/i18n/server";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { buildWeekIndexFromDate, buildWeekLabelFromDate, getRankingWeekReference } from "@/lib/chart-week";
import { LandingPage } from "@/components/landing/LandingPage";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { TimelineTabs, type ReviewItem } from "@/components/home/TimelineTabs";
import type { UserWithCharts } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
    alternates: { canonical: "/" },
  };
}

function daysUntilSundayBRT(): number {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const day = nowBRT.getUTCDay();
  return day === 0 ? 0 : 7 - day;
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

  const sorted = charts.sort((a, b) => {
    const aF = followingIds.has(a.user.id) ? 1 : 0;
    const bF = followingIds.has(b.user.id) ? 1 : 0;
    return bF - aF;
  });

  const seen = new Set<string>();
  return sorted.reduce<PublisherRow[]>((acc, c) => {
    if (seen.has(c.user.id)) return acc;
    seen.add(c.user.id);
    acc.push({
      userId: c.user.id,
      chartId: c.id,
      handle: c.user.handle,
      name: c.user.name,
      avatarColor: c.user.avatarColor,
      image: c.user.image,
      entryCount: c._count.entries,
    });
    return acc;
  }, []);
}

async function getTimelineFeed(
  userId: string,
  weekIdx: number,
  followingIds: Set<string>,
  locale: Awaited<ReturnType<typeof getServerLocale>>,
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
    friendsFeed: friendsRows.map((c) => mapChartRow(c, followingIds, likedSet, locale)),
    allFeed: allRows.map((c) => mapChartRow(c, followingIds, likedSet, locale)),
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
  locale: Awaited<ReturnType<typeof getServerLocale>>,
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
    postedAgo: formatRelativeTime(locale, c.publishedAt),
    isFollowing: followingIds.has(c.user.id),
    isLiked: likedSet.has(c.id),
  };
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const locale = await getServerLocale();
  const { t } = await getServerTranslations();

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
      (async () => {
        const primary = await prisma.parada.findFirst({
          where: { userId: session.user.id, isPrimary: true },
          select: { id: true },
        });
        if (!primary) return null;
        return prisma.chart.findUnique({
          where: { paradaId_weekIndex: { paradaId: primary.id, weekIndex: currentWeekIdx } },
          select: { id: true },
        });
      })(),
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
      getTimelineFeed(session.user.id, currentWeekIdx, followingIds, locale),
      getPublishedThisWeek(session.user.id, followingIds),
      getReviewsFeed(session.user.id, locale),
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
    <Shell title={t("home.title")} subtitle={t("home.subtitle")}>
      <HomeGrid feed={feed} sidebar={sidebar} />
    </Shell>
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

async function getReviewsFeed(userId: string, locale: Awaited<ReturnType<typeof getServerLocale>>): Promise<ReviewItem[]> {
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
    postedAgo: formatRelativeTime(locale, r.createdAt),
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
