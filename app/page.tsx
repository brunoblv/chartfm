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
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
} from "@/lib/chart-week";
import { LandingPage } from "@/components/landing/LandingPage";
import { LandingEditorialSection } from "@/components/landing/LandingEditorialSection";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { TimelineTabs } from "@/components/home/TimelineTabs";
import { CopaLiveFeedCarousel } from "@/components/home/CopaLiveFeedCarousel";
import { getCopaLiveFeedFixtures } from "@/lib/copa-live-feed";
import { getRecommendationsFeed } from "@/lib/recommendations-feed";
import { getSystemFeedPosts } from "@/lib/system-feed";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { resolveEditorialPreviewImages } from "@/lib/editorial-preview-image";
import { mergeHomeFeed, filterFollowingRecommendations } from "@/lib/home-mixed-feed";
import { getPrimaryParada } from "@/lib/paradas";
import { isParadaVisibleToViewer } from "@/lib/mytrl-access";
import { userActiveInLastDaysFilter } from "@/lib/user-activity";
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
  viewerHandle: string | null | undefined,
  followingIds: Set<string>,
): Promise<PublisherRow[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const charts = await prisma.chart.findMany({
    // parada.autoDecay: paradas "de estilo" simuladas (queda semanal) não entram no feed.
    where: { userId: { not: userId }, isPublished: true, postedAt: { gte: since }, parada: { autoDecay: false } },
    orderBy: { postedAt: "desc" },
    take: 30,
    select: {
      id: true,
      paradaId: true,
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
      _count: { select: { entries: true } },
    },
  });

  const visible = charts.filter((c) => isParadaVisibleToViewer(c.paradaId, viewerHandle));

  const sorted = visible.sort((a, b) => {
    const aF = followingIds.has(a.user.id) ? 1 : 0;
    const bF = followingIds.has(b.user.id) ? 1 : 0;
    return bF - aF;
  });

  const seen = new Set<string>();
  const publishers = sorted.reduce<PublisherRow[]>((acc, c) => {
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

  return publishers.slice(0, 15);
}

async function getTimelineFeed(
  userId: string,
  viewerHandle: string | null | undefined,
  weekIdx: number,
  followingIds: Set<string>,
  locale: Awaited<ReturnType<typeof getServerLocale>>,
) {
  const rows = await prisma.chart.findMany({
    where: {
      weekIndex: { gte: weekIdx - 2 },
      isPublished: true,
      // paradas "de estilo" simuladas (queda semanal) não entram no feed.
      parada: { autoDecay: false },
    },
    orderBy: { postedAt: "desc" },
    take: 80,
    select: {
      id: true,
      paradaId: true,
      weekLabel: true,
      dateRange: true,
      weekIndex: true,
      postedAt: true,
      likes: true,
      comments: true,
      reposts: true,
      parada: { select: { name: true } },
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

  const visibleRows = rows.filter((r) => isParadaVisibleToViewer(r.paradaId, viewerHandle));

  const sortByPublished = (a: (typeof visibleRows)[number], b: (typeof visibleRows)[number]) =>
    b.postedAt.getTime() - a.postedAt.getTime();

  const friendsRows = visibleRows
    .filter((r) => followingIds.has(r.user.id) || r.user.id === userId)
    .sort(sortByPublished)
    .slice(0, 30);

  const allRows = visibleRows.sort(sortByPublished).slice(0, 40);

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
    postedAt: Date; likes: number; comments: number; reposts: number;
    parada: { name: string };
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
      paradaNome: c.parada.name,
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
    postedAgo: formatRelativeTime(locale, c.postedAt),
    createdAt: c.postedAt.toISOString(),
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
    // A semana fechada de referência pode ainda não ter parada consolidada.
    // Para a landing usamos a semana mais recente que de fato tem dados.
    const dataWeekIndex = (await getLatestAvailableWeekIndex(rankingWeek.weekIndex)) ?? rankingWeek.weekIndex;
    const weekRefDate = getWeeklySnapshotReferenceDate(dataWeekIndex, await getGlobalPublishSlot());
    const weekLabel = buildWeekLabelFromDate(weekRefDate);
    const [globalChart, userCount, recentUsers, chartsThisWeek, publishersThisWeek] = await Promise.all([
      getGlobalTopSongs(dataWeekIndex, 100),
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, avatarColor: true, image: true },
      }),
      prisma.chart.count({ where: { weekIndex: dataWeekIndex } }),
      prisma.chart.groupBy({ by: ["userId"], where: { weekIndex: dataWeekIndex } }),
    ]);
    return (
      <LandingPage globalChart={globalChart} userCount={userCount} chartsThisWeek={chartsThisWeek} recentUsers={recentUsers}>
        <LandingEditorialSection
          globalChart={globalChart}
          weekLabel={weekLabel}
          weekIndex={dataWeekIndex}
          publishersThisWeek={publishersThisWeek.length}
        />
      </LandingPage>
    );
  }

  let userStreak = 0;
  let userParadaNome: string | null = null;
  let primaryParadaId: string | null = null;
  let thisWeekChartId: string | null = null;
  let userGenres: string[] = [];
  let followingIds = new Set<string>();

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const currentWeekIdx = buildWeekIndexFromDate(nowBRT);
  const rankingWeek = getRankingWeekReference();

  if (session?.user?.id) {
    const userId = session.user.id;
    const [user, primaryWeek, followRows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { streak: true, genres: true },
      }),
      (async () => {
        const primary = await getPrimaryParada(prisma, userId);
        const chart = await prisma.chart.findUnique({
          where: { paradaId_weekIndex: { paradaId: primary.id, weekIndex: currentWeekIdx } },
          select: { id: true },
        });
        return { primary, chart };
      })(),
      prisma.userFollow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
    ]);

    if (user && !user.genres?.length) redirect("/onboarding");

    userStreak = user?.streak ?? 0;
    userParadaNome = primaryWeek.primary.name;
    primaryParadaId = primaryWeek.primary.id;
    userGenres = user?.genres ?? [];
    thisWeekChartId = primaryWeek.chart?.id ?? null;
    followingIds = new Set(followRows.map((r) => r.followingId));
  }

  const [daysLeft, trendingArtists, globalTopSongs, suggestedUsers, newUsers, timelineFeeds, publishedToday, reviewsFeed, reviewsForYou, followingReviews, recommendationsFeed, systemFeedPosts, copaLiveFeed, editorialPicks] =
    await Promise.all([
      Promise.resolve(daysUntilSundayBRT()),
      getTrendingArtists(rankingWeek.weekIndex),
      getGlobalTopSongs(rankingWeek.weekIndex, 3),
      getSuggestedUsers(session.user.id, userGenres, followingIds, 5),
      getNewUsers(session.user.id, followingIds, 5),
      getTimelineFeed(session.user.id, session.user.handle, currentWeekIdx, followingIds, locale),
      getPublishedThisWeek(session.user.id, session.user.handle, followingIds),
      getReviewsFeed(session.user.id, locale),
      getReviewsFeed(session.user.id, locale, { excludeSelf: false, limit: 25 }),
      getReviewsFeed(session.user.id, locale, {
        onlyUserIds: [...followingIds, session.user.id],
        excludeSelf: false,
        limit: 20,
      }),
      getRecommendationsFeed(session.user.id, locale).catch((err) => {
        console.error("[home] getRecommendationsFeed", err);
        return [] as Awaited<ReturnType<typeof getRecommendationsFeed>>;
      }),
      getSystemFeedPosts(locale).catch((err) => {
        console.error("[home] getSystemFeedPosts", err);
        return [] as Awaited<ReturnType<typeof getSystemFeedPosts>>;
      }),
      getCopaLiveFeedFixtures(session.user.id).catch((err) => {
        console.error("[home] getCopaLiveFeedFixtures", err);
        return null;
      }),
      getEditorialPicksSorted().catch((err) => {
        console.error("[home] getEditorialPicksSorted", err);
        return [] as Awaited<ReturnType<typeof getEditorialPicksSorted>>;
      }),
    ]);
  const { friendsFeed, allFeed } = timelineFeeds;
  // Resolve capa (YouTube/Spotify) dos picks sem previewImage para o card do feed mostrar foto.
  const editorialPreviewImages = await resolveEditorialPreviewImages(editorialPicks).catch((err) => {
    console.error("[home] resolveEditorialPreviewImages", err);
    return new Map<string, string | null>();
  });
  const editorialPicksWithImages = editorialPicks.map((pick) => ({
    ...pick,
    previewImage: editorialPreviewImages.get(pick.slug) ?? pick.previewImage,
  }));
  const recentEditorialPicks = editorialPicksWithImages.slice(0, 10);

  const forYouFeed = mergeHomeFeed(allFeed, reviewsForYou, recommendationsFeed, 30, systemFeedPosts, recentEditorialPicks);
  const followingFeed = mergeHomeFeed(
    friendsFeed,
    followingReviews,
    filterFollowingRecommendations(recommendationsFeed, followingIds, session.user.id),
    30,
    systemFeedPosts,
    recentEditorialPicks,
  );

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <YourWeekCard
        streak={userStreak}
        daysLeft={daysLeft}
        paradaNome={userParadaNome}
        primaryParadaId={primaryParadaId}
        thisWeekChartId={thisWeekChartId}
      />

      {publishedToday.length > 0 && <FriendsRow publishers={publishedToday} />}

      {copaLiveFeed && copaLiveFeed.fixtures.length > 0 && (
        <CopaLiveFeedCarousel initial={copaLiveFeed} />
      )}

      <TimelineTabs
        forYouFeed={forYouFeed}
        followingFeed={followingFeed}
        reviewsFeed={reviewsFeed}
        recommendationsFeed={recommendationsFeed}
        editorialFeed={editorialPicksWithImages}
      />
    </div>
  );

  const sidebar = (
    <>
      <GlobalTeaser topSongs={globalTopSongs} weekLabel={rankingWeek.weekLabel} />
      <SuggestedUsers
        users={suggestedUsers.map((u) => ({ ...u, isFollowing: followingIds.has(u.id) }))}
        newUsers={newUsers.map((u) => ({ ...u, isFollowing: followingIds.has(u.id) }))}
      />
      <TrendingArtists artists={trendingArtists} weekLabel={rankingWeek.weekLabel} />
    </>
  );

  return (
    <Shell>
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
  image: string | null;
  commonGenres: number;
  isFollowing?: boolean;
};

async function getSuggestedUsers(
  userId: string,
  genres: string[],
  followingIds: Set<string>,
  limit = 5,
): Promise<SuggestedUserRow[]> {
  const excludeIds = [userId, ...followingIds];
  const activeFilter = userActiveInLastDaysFilter(7);
  const where = genres.length
    ? { id: { notIn: excludeIds }, genres: { hasSome: genres }, ...activeFilter }
    : { id: { notIn: excludeIds }, ...activeFilter };
  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, handle: true, name: true, followers: true, avatarColor: true, image: true, genres: true },
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
      image: u.image,
      commonGenres: genres.length ? u.genres.filter((g) => genres.includes(g)).length : 0,
    }))
    .sort((a, b) => {
      if (b.commonGenres !== a.commonGenres) return b.commonGenres - a.commonGenres;
      return b.followers - a.followers;
    })
    .slice(0, limit);

  if (ranked.length >= limit || genres.length === 0) return ranked;

  const fallback = await prisma.user.findMany({
    where: { id: { notIn: [...excludeIds, ...ranked.map((r) => r.id)] }, ...activeFilter },
    select: { id: true, handle: true, name: true, followers: true, avatarColor: true, image: true, genres: true },
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
      image: u.image,
      commonGenres: genres.length ? u.genres.filter((g) => genres.includes(g)).length : 0,
    })),
  ];
}

async function getNewUsers(userId: string, followingIds: Set<string>, limit = 5): Promise<SuggestedUserRow[]> {
  const users = await prisma.user.findMany({
    where: { id: { notIn: [userId, ...followingIds] } },
    select: { id: true, handle: true, name: true, followers: true, avatarColor: true, image: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return users.map((u) => ({
    id: u.id,
    handle: u.handle,
    name: u.name,
    followers: u.followers,
    avatarColor: u.avatarColor,
    image: u.image,
    commonGenres: 0,
  }));
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
    spotifyId: spotifyId ?? null,
    imageUrl: (spotifyId ? bySpotifyId.get(spotifyId) : null) ?? byName.get(name.toLowerCase()) ?? null,
  }));
}

async function getReviewsFeed(
  userId: string,
  locale: Awaited<ReturnType<typeof getServerLocale>>,
  options?: {
    onlyUserIds?: string[];
    excludeSelf?: boolean;
    limit?: number;
  },
) {
  const rows = await prisma.albumReview.findMany({
    where: {
      ...(options?.onlyUserIds?.length ? { userId: { in: options.onlyUserIds } } : {}),
      ...(options?.excludeSelf !== false ? { userId: { not: userId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
    select: {
      id: true,
      rating: true,
      body: true,
      helpful: true,
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
    helpful: r.helpful,
    postedAgo: formatRelativeTime(locale, r.createdAt),
    createdAt: r.createdAt.toISOString(),
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

/** Semana mais recente (<= referência) que possui parada consolidada ou charts publicadas. */
async function getLatestAvailableWeekIndex(maxWeekIndex: number): Promise<number | null> {
  const [latestSnap, latestChart] = await Promise.all([
    prisma.globalSnapshot.findFirst({
      where: { weekIndex: { lte: maxWeekIndex } },
      orderBy: { weekIndex: "desc" },
      select: { weekIndex: true },
    }),
    prisma.chart.findFirst({
      where: { weekIndex: { lte: maxWeekIndex } },
      orderBy: { weekIndex: "desc" },
      select: { weekIndex: true },
    }),
  ]);
  const candidates = [latestSnap?.weekIndex, latestChart?.weekIndex].filter(
    (v): v is number => typeof v === "number",
  );
  return candidates.length ? Math.max(...candidates) : null;
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
