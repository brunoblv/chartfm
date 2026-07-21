import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
import { MixedFeedList } from "@/components/home/MixedFeedList";
import { GlobalTeaser, TrendingArtists } from "@/components/home/HomeSidebar";
import { formatRelativeTime } from "@/lib/i18n/format";
import { getServerLocale } from "@/lib/i18n/server";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { isParadaVisibleToViewer } from "@/lib/mytrl-access";
import { mergeHomeFeed } from "@/lib/home-mixed-feed";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { resolveEditorialPreviewImages } from "@/lib/editorial-preview-image";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";
import type { UserWithCharts, GlobalChartEntry } from "@/lib/types";
import type { ReviewItem, TimelineItem } from "@/components/home/TimelineTabs";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("feed.metaTitle"),
    description: t("feed.metaDescription"),
    alternates: { canonical: "/feed" },
  };
}

type PublicChartRow = {
  id: string;
  paradaId: string;
  weekLabel: string;
  dateRange: string;
  weekIndex: number;
  postedAt: Date;
  likes: number;
  comments: number;
  reposts: number;
  parada: { name: string };
  community: { slug: string; name: string; icon: string; logoUrl: string | null; coverA: string } | null;
  user: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
    followers: number;
    verified: boolean;
    streak: number;
    bio: string | null;
    following: number;
    paradaNome: string | null;
    paradaLogo: string | null;
  };
  entries: {
    position: number;
    status: string;
    delta: number | null;
    prevPos: number | null;
    peak: number;
    weeks: number;
    coverPaletteA: string;
    coverPaletteB: string;
    coverSeed: number;
    song: {
      id: string;
      title: string;
      artist: string;
      album: string | null;
      albumRef: { id: number; coverUrl: string | null } | null;
      spotifyId: string | null;
      artistSpotifyId: string | null;
      artistRef: { id: number; name: string } | null;
    };
  }[];
};

function mapPublicChartRow(c: PublicChartRow, locale: Awaited<ReturnType<typeof getServerLocale>>): TimelineItem {
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
      community: c.community,
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
    isFollowing: false,
    isLiked: false,
  };
}

async function getPublicTimelineFeed(locale: Awaited<ReturnType<typeof getServerLocale>>): Promise<TimelineItem[]> {
  const rows = await prisma.chart.findMany({
    where: {
      isPublished: true,
    },
    orderBy: { postedAt: "desc" },
    take: 30,
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
      community: { select: { slug: true, name: true, icon: true, logoUrl: true, coverA: true } },
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

  return rows
    // visitante anônimo: sem handle, então paradas restritas a um dono específico ficam ocultas.
    .filter((r) => isParadaVisibleToViewer(r.paradaId, null))
    .map((c) => mapPublicChartRow(c, locale));
}

async function getPublicReviewsFeed(locale: Awaited<ReturnType<typeof getServerLocale>>): Promise<ReviewItem[]> {
  const rows = await prisma.albumReview.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      body: true,
      helpful: true,
      createdAt: true,
      user: {
        select: { id: true, handle: true, name: true, avatarColor: true, image: true, verified: true },
      },
      album: {
        select: {
          id: true,
          title: true,
          exhibitionName: true,
          coverUrl: true,
          artist: { select: { id: true, name: true, exhibitionName: true } },
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

/** Top 3 do Global 100 — mesma quantidade usada no teaser da home logada. */
async function getGlobalTeaserData(limit = 3): Promise<{ weekLabel: string; songs: GlobalChartEntry[] }> {
  const rankingWeek = getRankingWeekReference(new Date(), await getGlobalPublishSlot());
  const latest = await prisma.globalSnapshot.findFirst({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    orderBy: { weekIndex: "desc" },
    select: { weekLabel: true, weeklySongs: true },
  });
  if (!latest) return { weekLabel: rankingWeek.weekLabel, songs: [] };
  const songs = (latest.weeklySongs as unknown as GlobalChartEntry[]).slice(0, limit);
  return { weekLabel: latest.weekLabel, songs };
}

/** Artistas em alta da semana — mesma quantidade (4) usada na sidebar da home logada. */
async function getTrendingArtistsData(limit = 4) {
  const rankingWeek = getRankingWeekReference(new Date(), await getGlobalPublishSlot());
  const entries: WeeklyChartEntryRow[] = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: rankingWeek.weekIndex } },
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
  const bySpotifyId = new Map(artistRows.filter((a) => a.spotifyId).map((a) => [a.spotifyId as string, a.imageUrl]));
  const byName = new Map(artistRows.map((a) => [a.name.toLowerCase(), a.imageUrl]));

  return {
    weekLabel: rankingWeek.weekLabel,
    artists: ranked.map(({ name, totalPoints, chartCount, spotifyId }) => ({
      name,
      totalPoints,
      chartCount,
      spotifyId: spotifyId ?? null,
      imageUrl: (spotifyId ? bySpotifyId.get(spotifyId) : null) ?? byName.get(name.toLowerCase()) ?? null,
    })),
  };
}

export default async function PublicFeedPage() {
  const locale = await getServerLocale();
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const authed = Boolean(session?.user?.id);

  const [charts, reviews, editorialPicks, globalTeaser, trending] = await Promise.all([
    getPublicTimelineFeed(locale),
    getPublicReviewsFeed(locale),
    getEditorialPicksSorted().catch((err) => {
      console.error("[feed] getEditorialPicksSorted", err);
      return [] as Awaited<ReturnType<typeof getEditorialPicksSorted>>;
    }),
    getGlobalTeaserData(3),
    getTrendingArtistsData(4),
  ]);

  const editorialPreviewImages = await resolveEditorialPreviewImages(editorialPicks).catch((err) => {
    console.error("[feed] resolveEditorialPreviewImages", err);
    return new Map<string, string | null>();
  });
  const editorialPicksWithImages = editorialPicks.map((pick) => ({
    ...pick,
    previewImage: editorialPreviewImages.get(pick.slug) ?? pick.previewImage,
  }));

  const feed = mergeHomeFeed(charts, reviews, [], 40, [], editorialPicksWithImages.slice(0, 8));

  const feedColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!authed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 18,
            padding: "22px 24px",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {t("feed.publicBannerTitle")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
              {t("feed.publicBannerPrefix")}{" "}
              <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                {t("feed.createAccount")}
              </Link>{" "}
              {t("feed.or")}{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                {t("feed.signIn")}
              </Link>
              .
            </div>
          </div>
          <Link
            href="/signup"
            style={{
              flexShrink: 0,
              padding: "11px 22px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("feed.ctaBanner")}
          </Link>
        </div>
      )}

      <MixedFeedList items={feed} />
    </div>
  );

  const sidebar = (
    <>
      <GlobalTeaser topSongs={globalTeaser.songs} weekLabel={globalTeaser.weekLabel} />
      {!authed && (
        <div
          style={{
            background: "var(--accent-tint)",
            border: "1px solid rgba(250,36,60,0.15)",
            borderRadius: 18,
            padding: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("feed.sidebarCreateAccount")}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-subtle)", lineHeight: 1.5, marginBottom: 14 }}>
            {t("feed.sidebarCreateAccountBody")}
          </div>
          <Link
            href="/signup"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("feed.sidebarCreateAccountCta")}
          </Link>
        </div>
      )}
      <TrendingArtists artists={trending.artists} weekLabel={trending.weekLabel} />
    </>
  );

  return (
    <Shell noPadding>
      <div style={{ padding: "28px 40px 60px" }}>
        <HomeGrid feed={feedColumn} sidebar={sidebar} />
      </div>
    </Shell>
  );
}
