import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { buildArtistPath } from "@/lib/music-routes";
import { Crown, Flame, Sparkles } from "lucide-react";
import { getPreviousClosedWeekDate, getRankingWeekReference, buildWeekIndexFromDate } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import type { Locale } from "@/lib/i18n/config";
import { getLatestCuratorsSnapshot } from "@/lib/curators-snapshot";
import { MomentsFeed } from "@/components/discover/MomentsFeed";
import { getAutoMoments, getMomentsFeed } from "@/lib/moments-feed";
import { Cover } from "@/components/ui/Cover";
import { ScoreSquare } from "@/components/ui/ScoreSquare";
import { buildAlbumPath } from "@/lib/music-routes";
import { getWeeklySpotlightWinners, WEEKLY_POLL_PATH } from "@/lib/weekly-spotlight-poll";
import { Disc3, Globe2, Music2, Radio } from "lucide-react";
import { GLOBAL_100_FIXED_SPOTIFY_PLAYLIST_ID } from "@/lib/mytrl-access";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: `${t("discover.title")} | ChartFM`,
    description: t("discover.metaDescription"),
    alternates: { canonical: "/discover" },
  };
}

export default async function DiscoverPage() {
  const { t, locale } = await getServerTranslations();
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT, await getGlobalPublishSlot());
  const prevWeekDate = new Date(getPreviousClosedWeekDate(nowBRT).getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekIndex = buildWeekIndexFromDate(prevWeekDate);
  return loadPageData(rankingWeek.weekIndex, rankingWeek.weekLabel, prevWeekIndex, t, locale);
}

type ArtistWeekRow = {
  name: string;
  spotifyId?: string | null;
  imageUrl?: string | null;
  listeners: number;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

function normalizeArtistName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

type TasteMatch = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
  commonGenres: string[];
  overlapPct: number;
};

/** Pessoas com sobreposição de gêneros com o usuário logado, ordenadas pela % de gosto em comum. */
async function getTasteMatches(
  userId: string | null,
  userGenres: string[],
  followingIds: Set<string>,
  limit = 3,
): Promise<TasteMatch[]> {
  if (!userId || userGenres.length === 0) return [];

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: [userId, ...followingIds] },
      genres: { hasSome: userGenres },
    },
    select: { id: true, handle: true, name: true, avatarColor: true, image: true, genres: true },
    orderBy: { followers: "desc" },
    take: 30,
  });

  return candidates
    .map((u) => {
      const commonGenres = u.genres.filter((g) => userGenres.includes(g));
      return {
        id: u.id,
        handle: u.handle,
        name: u.name,
        avatarColor: u.avatarColor,
        image: u.image,
        commonGenres,
        overlapPct: Math.round((commonGenres.length / userGenres.length) * 100),
      };
    })
    .filter((u) => u.commonGenres.length > 0)
    .sort((a, b) => b.overlapPct - a.overlapPct || b.commonGenres.length - a.commonGenres.length)
    .slice(0, limit);
}

async function loadPageData(
  weekIndex: number,
  weekLabel: string,
  prevWeekIndex: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: Locale,
) {
  const session = await getServerSession(authOptions);
  const [curatorsSnapshot, followRows, myGenres, weeklyEntries, previousEntries] = await Promise.all([
    getLatestCuratorsSnapshot(weekIndex),
    session?.user?.id
      ? prisma.userFollow.findMany({
          where: { followerId: session.user.id },
          select: { followingId: true },
        })
      : Promise.resolve([] as Array<{ followingId: string }>),
    session?.user?.id
      ? prisma.user.findUnique({ where: { id: session.user.id }, select: { genres: true } })
      : Promise.resolve(null),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex, isPublished: true } },
      select: {
        position: true,
        chartId: true,
        chart: {
          select: { userId: true },
        },
        song: {
          select: {
            title: true,
            artist: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { name: true, spotifyId: true, genres: true, imageUrl: true } },
          },
        },
      },
    }),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: prevWeekIndex, isPublished: true } },
      select: {
        position: true,
        chartId: true,
        chart: {
          select: { userId: true },
        },
        song: {
          select: {
            title: true,
            artist: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { name: true, spotifyId: true, genres: true, imageUrl: true } },
          },
        },
      },
    }),
  ]);

  const followingIds = new Set(followRows.map((r) => r.followingId));

  const [tasteMatches, momentsPage, autoMoments, openPoll, latestClosedPoll, topCommunities, latestReviews] =
    await Promise.all([
      getTasteMatches(session?.user?.id ?? null, myGenres?.genres ?? [], followingIds, 3),
      getMomentsFeed({ viewerId: session?.user?.id ?? null, locale, scope: "all", limit: 10 }),
      getAutoMoments(locale, 4),
      prisma.weeklySpotlightPoll.findFirst({ where: { status: "open" }, select: { id: true } }),
      prisma.weeklySpotlightPoll.findFirst({
        where: { status: "closed" },
        orderBy: { weekIndex: "desc" },
        select: { weekIndex: true },
      }),
      prisma.community.findMany({
        where: { privacy: "public" },
        orderBy: { members: "desc" },
        take: 5,
        select: { slug: true, name: true, icon: true, members: true },
      }),
      prisma.albumReview.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          rating: true,
          user: { select: { name: true, avatarColor: true, image: true, handle: true } },
          album: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              artist: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

  const spotlightWinners = latestClosedPoll
    ? await getWeeklySpotlightWinners(latestClosedPoll.weekIndex)
    : [];
  const spotlightWinner = spotlightWinners.find((w) => w.category === "destaque") ?? null;
  const flashbackWinner = spotlightWinners.find((w) => w.category === "flashback") ?? null;

  const rankedCurators = (curatorsSnapshot?.entries ?? []).slice(0, 5);

  const aggregateArtists = (rows: typeof weeklyEntries) => {
    const map = new Map<string, { points: number; chartIds: Set<string>; userIds: Set<string>; spotifyId: string | null; imageUrl: string | null }>();
    for (const row of rows) {
      const name = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
      const sid = row.song.artistRef?.spotifyId ?? row.song.artistSpotifyId ?? null;
      const img = row.song.artistRef?.imageUrl ?? null;
      const cur = map.get(name) ?? { points: 0, chartIds: new Set<string>(), userIds: new Set<string>(), spotifyId: null, imageUrl: null };
      cur.points += 1;
      cur.chartIds.add(row.chartId);
      cur.userIds.add(row.chart.userId);
      if (sid) cur.spotifyId = cur.spotifyId ?? sid;
      if (img) cur.imageUrl = cur.imageUrl ?? img;
      map.set(name, cur);
    }
    return map;
  };

  const currentMap = aggregateArtists(weeklyEntries);
  const previousMap = aggregateArtists(previousEntries);

  const currentSorted = [...currentMap.entries()]
    .map(([name, stats]) => ({
      name,
      spotifyId: stats.spotifyId,
      imageUrl: stats.imageUrl,
      listeners: stats.chartIds.size,
      users: stats.userIds.size,
      totalPoints: stats.points,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.listeners - a.listeners || a.users - b.users || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 10);

  const prevPosByName = new Map(
    [...previousMap.entries()]
      .map(([name, stats]) => ({ name, points: stats.points, listeners: stats.chartIds.size, users: stats.userIds.size }))
      .sort((a, b) => b.points - a.points || b.listeners - a.listeners || b.users - a.users || a.name.localeCompare(b.name, "pt-BR"))
      .map((row, idx) => [row.name, idx + 1]),
  );

  const trendingArtists: ArtistWeekRow[] = currentSorted.map((row, idx) => {
    const position = idx + 1;
    const prevPos = prevPosByName.get(row.name) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: ArtistWeekRow["status"] =
      prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    return { name: row.name, spotifyId: row.spotifyId, imageUrl: row.imageUrl, listeners: row.listeners, users: row.users, status, delta };
  });

  const sidebarCard: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--divider)",
    borderRadius: 16,
    padding: 16,
  };
  const sidebarTitle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 12,
  };

  return (
    <Shell title={t("discover.title")} subtitle={t("moments.hubQuestion")}>

      {/* ===== HUB SOCIAL: FEED + SIDEBAR ===== */}
      <section style={{ marginBottom: 52 }}>
        <HomeGrid
          feed={
            <MomentsFeed
              initialItems={momentsPage.items}
              initialNextCursor={momentsPage.nextCursor}
              autoItems={autoMoments}
              isLoggedIn={!!session?.user?.id}
            />
          }
          sidebar={
            <>
              {/* 🔥 Em Alta */}
              {trendingArtists.length > 0 && (
                <div style={sidebarCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ ...sidebarTitle, marginBottom: 0 }}>
                      <Flame size={15} color="var(--accent)" />
                      {t("moments.sidebarTrending")}
                    </span>
                    <Link href="/global" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      {t("moments.viewAll")}
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {trendingArtists.slice(0, 5).map((a) => (
                      <Link
                        key={a.name}
                        href={buildArtistPath(a.name, a.spotifyId)}
                        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
                      >
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.imageUrl}
                            alt={a.name}
                            width={36}
                            height={36}
                            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--fill-subtle)", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {t("moments.sidebarTrendingCount", { count: a.users })}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 🎶 Música da Semana */}
              {(spotlightWinner || openPoll) && (
                <div
                  style={{
                    background: "var(--gradient-hero)",
                    borderRadius: 16,
                    padding: 16,
                    color: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 800, opacity: 0.92, marginBottom: 10 }}>
                    <Music2 size={14} />
                    {t("moments.sidebarSongOfWeek")}
                  </div>
                  {spotlightWinner ? (
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Cover
                        cover={spotlightWinner.song.cover}
                        song={{ title: spotlightWinner.song.title, artist: spotlightWinner.song.artist }}
                        size={64}
                        rounded={12}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {spotlightWinner.song.title}
                        </div>
                        <div style={{ fontSize: 12.5, opacity: 0.88 }}>{spotlightWinner.song.artist}</div>
                        {openPoll && (
                          <Link
                            href={WEEKLY_POLL_PATH}
                            style={{
                              display: "inline-block",
                              marginTop: 8,
                              padding: "6px 14px",
                              borderRadius: 100,
                              background: "#fff",
                              color: "var(--accent)",
                              fontWeight: 800,
                              fontSize: 12,
                              textDecoration: "none",
                            }}
                          >
                            {t("moments.sidebarVote")}
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.92 }}>{t("moments.sidebarPollOpen")}</div>
                      <Link
                        href={WEEKLY_POLL_PATH}
                        style={{
                          alignSelf: "flex-start",
                          padding: "7px 16px",
                          borderRadius: 100,
                          background: "#fff",
                          color: "var(--accent)",
                          fontWeight: 800,
                          fontSize: 12.5,
                          textDecoration: "none",
                        }}
                      >
                        {t("moments.sidebarVote")}
                      </Link>
                    </div>
                  )}
                  {flashbackWinner && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t("moments.sidebarFlashback")}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Cover
                          cover={flashbackWinner.song.cover}
                          song={{ title: flashbackWinner.song.title, artist: flashbackWinner.song.artist }}
                          size={40}
                          rounded={9}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {flashbackWinner.song.title}
                          </div>
                          <div style={{ fontSize: 11.5, opacity: 0.85 }}>{flashbackWinner.song.artist}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 📻 Playlist da Semana (Global 100 fixa no Spotify) */}
              <div style={sidebarCard}>
                <span style={sidebarTitle}>
                  <Radio size={15} />
                  {t("moments.sidebarPlaylist")}
                </span>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                  {t("moments.sidebarPlaylistDesc")}
                </p>
                <a
                  href={`https://open.spotify.com/playlist/${GLOBAL_100_FIXED_SPOTIFY_PLAYLIST_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "9px 16px",
                    borderRadius: 100,
                    background: "#1DB954",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12.5,
                    textDecoration: "none",
                  }}
                >
                  {t("moments.sidebarPlaylistCta")}
                </a>
              </div>

              {/* 👑 Membros em Destaque */}
              {rankedCurators.length > 0 && (
                <div style={sidebarCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ ...sidebarTitle, marginBottom: 0 }}>
                      <Crown size={15} />
                      {t("moments.sidebarMembers")}
                    </span>
                    <Link href="/discover/curators" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      {t("moments.viewAll")}
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {rankedCurators.map((row) => (
                      <div key={row.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <Avatar user={{ name: row.name, avatar: row.avatarColor }} imageUrl={row.image} size={32} />
                          <div
                            style={{
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              background: "var(--accent)",
                              color: "white",
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "1px 4px",
                              borderRadius: 5,
                              border: "2px solid var(--surface)",
                            }}
                          >
                            #{row.position}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.name}
                        </div>
                        <FollowButton
                          targetId={row.userId}
                          initialFollowing={followingIds.has(row.userId)}
                          variant="outline"
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🌎 Comunidades em Alta */}
              {topCommunities.length > 0 && (
                <div style={sidebarCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ ...sidebarTitle, marginBottom: 0 }}>
                      <Globe2 size={15} />
                      {t("moments.sidebarCommunities")}
                    </span>
                    <Link href="/communities" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      {t("moments.viewAll")}
                    </Link>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {topCommunities.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/community/${c.slug}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 12px",
                          borderRadius: 100,
                          background: "var(--fill-subtle)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text)",
                          textDecoration: "none",
                        }}
                      >
                        <span>{c.icon}</span>
                        {c.name}
                        <span style={{ color: "var(--text-muted)" }}>· {c.members}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 📀 Últimas Avaliações */}
              {latestReviews.length > 0 && (
                <div style={sidebarCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ ...sidebarTitle, marginBottom: 0 }}>
                      <Disc3 size={15} />
                      {t("moments.sidebarReviews")}
                    </span>
                    <Link href="/criticsfm" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      {t("moments.viewAll")}
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {latestReviews.map((rv) => (
                      <div key={rv.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Link href={`/profile/${rv.user.handle}`} style={{ flexShrink: 0 }}>
                          <Avatar user={{ name: rv.user.name, avatar: rv.user.avatarColor }} imageUrl={rv.user.image} size={28} />
                        </Link>
                        <Link
                          href={buildAlbumPath(rv.album.title, rv.album.artist.name, {
                            artistId: rv.album.artist.id,
                            albumId: rv.album.id,
                          })}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                          }}
                        >
                          {rv.album.title}
                          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {rv.album.artist.name}</span>
                        </Link>
                        <ScoreSquare score={rv.rating} size={26} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ✨ Pessoas com o seu gosto */}
              {tasteMatches.length > 0 && (
                <div style={sidebarCard}>
                  <span style={sidebarTitle}>
                    <Sparkles size={15} />
                    {t("moments.sidebarTaste")}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {tasteMatches.map((match) => (
                      <div key={match.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Link href={`/profile/${match.handle}`} style={{ flexShrink: 0 }}>
                          <Avatar user={{ name: match.name, avatar: match.avatarColor }} imageUrl={match.image} size={32} />
                        </Link>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            href={`/profile/${match.handle}`}
                            style={{
                              display: "block",
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textDecoration: "none",
                            }}
                          >
                            {match.name}
                          </Link>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {match.overlapPct}% · {match.commonGenres.slice(0, 2).join(", ")}
                          </div>
                        </div>
                        <FollowButton targetId={match.id} variant="outline" size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          }
        />
      </section>

    </Shell>
  );
}
