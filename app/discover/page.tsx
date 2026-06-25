import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { HotTabs } from "./HotTabs";
import { getPreviousClosedWeekDate, getRankingWeekReference, buildWeekIndexFromDate } from "@/lib/chart-week";
import { BookOpen } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { formatWeekLabel } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: `${t("discover.title")} | ChartFM`,
    description: t("discover.metaDescription"),
    alternates: { canonical: "/discover" },
  };
}

const GENRES = [
  { slug: "pop", name: "Pop", color: ["#FA243C", "#FF5858"], letter: "P", tags: ["pop"] },
  { slug: "hip-hop-rap", name: "Hip-Hop/Rap", color: ["#1D1D1F", "#4A4A4F"], letter: "H", tags: ["hip hop", "rap", "trap"] },
  { slug: "sertanejo", name: "Sertanejo", color: ["#E36414", "#FFD166"], letter: "S", tags: ["sertanejo"] },
  { slug: "rnb-soul", name: "R&B/Soul", color: ["#6A0572", "#AB83A1"], letter: "R", tags: ["r&b", "soul", "neo soul"] },
  { slug: "indie-alt", name: "Indie/Alt", color: ["#06D6A0", "#073B4C"], letter: "I", tags: ["indie", "alternative", "alt"] },
  { slug: "funk", name: "Funk", color: ["#EF476F", "#FFD166"], letter: "F", tags: ["funk"] },
  { slug: "eletronica", name: "Eletrônica", color: ["#8338EC", "#3A86FF"], letter: "E", tags: ["electronic", "dance", "house", "techno", "edm", "eletronica", "eletronic"] },
  { slug: "k-pop", name: "K-Pop", color: ["#FB5607", "#FFBE0B"], letter: "K", tags: ["k-pop", "kpop"] },
];

function buildFaq(t: (key: string) => string) {
  return [
    { q: t("discover.faq1Q"), a: t("discover.faq1A") },
    { q: t("discover.faq2Q"), a: t("discover.faq2A") },
    { q: t("discover.faq3Q"), a: t("discover.faq3A") },
    { q: t("discover.faq4Q"), a: t("discover.faq4A") },
    { q: t("discover.faq5Q"), a: t("discover.faq5A") },
  ];
}

export default async function DiscoverPage() {
  const { t, locale } = await getServerTranslations();
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
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

type SongWeekRow = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

function normalizeArtistName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

async function loadPageData(
  weekIndex: number,
  weekLabel: string,
  prevWeekIndex: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: Locale,
) {
  const weekLabelDisplay = formatWeekLabel(locale, weekLabel);
  const session = await getServerSession(authOptions);
  const [curatorCharts, followRows, weeklyEntries, previousEntries] = await Promise.all([
    prisma.chart.findMany({
      where: { weekIndex, isPublished: true },
      orderBy: [{ publishedAt: "asc" }],
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            handle: true,
            name: true,
            bio: true,
            image: true,
            avatarColor: true,
            streak: true,
          },
        },
      },
    }),
    session?.user?.id
      ? prisma.userFollow.findMany({
          where: { followerId: session.user.id },
          select: { followingId: true },
        })
      : Promise.resolve([] as Array<{ followingId: string }>),
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

  // Pontuação por atividade da pessoa na semana: criar parada = 100,
  // cada like dado em paradas = 5, cada comentário escrito = 25.
  const candidateUserIds = [...new Set(curatorCharts.map((c) => c.userId))];
  const [likesGivenRows, commentsWrittenRows] = await Promise.all([
    candidateUserIds.length
      ? prisma.chartLike.groupBy({
          by: ["userId"],
          where: { userId: { in: candidateUserIds }, chart: { weekIndex, isPublished: true } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ userId: string; _count: { _all: number } }>),
    candidateUserIds.length
      ? prisma.comment.groupBy({
          by: ["userId"],
          where: { userId: { in: candidateUserIds }, chart: { weekIndex, isPublished: true } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ userId: string; _count: { _all: number } }>),
  ]);
  const likesGivenByUser = new Map(likesGivenRows.map((r) => [r.userId, r._count._all]));
  const commentsWrittenByUser = new Map(commentsWrittenRows.map((r) => [r.userId, r._count._all]));

  const curatorByUser = new Map<string, { chartId: string; chartCount: number; user: (typeof curatorCharts)[number]["user"] }>();
  for (const c of curatorCharts) {
    const existing = curatorByUser.get(c.userId);
    if (existing) existing.chartCount += 1;
    else curatorByUser.set(c.userId, { chartId: c.id, chartCount: 1, user: c.user });
  }

  const rankedCurators = [...curatorByUser.values()]
    .map((row) => {
      const likesGiven = likesGivenByUser.get(row.user.id) ?? 0;
      const commentsWritten = commentsWrittenByUser.get(row.user.id) ?? 0;
      return {
        id: row.chartId,
        user: row.user,
        chartCount: row.chartCount,
        likesGiven,
        commentsWritten,
        score: row.chartCount * 100 + likesGiven * 5 + commentsWritten * 25,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.commentsWritten !== a.commentsWritten) return b.commentsWritten - a.commentsWritten;
      return b.likesGiven - a.likesGiven;
    })
    .slice(0, 5);

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

  const aggregateSongsByUsers = (rows: typeof weeklyEntries) => {
    const map = new Map<string, { title: string; artist: string; spotifyId: string | null; artistSpotifyId: string | null; users: Set<string> }>();
    for (const row of rows) {
      const title = row.song.title.trim();
      const artist = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
      const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      const cur = map.get(key) ?? { title, artist, spotifyId: row.song.spotifyId ?? null, artistSpotifyId: row.song.artistRef?.spotifyId ?? row.song.artistSpotifyId ?? null, users: new Set<string>() };
      cur.users.add(row.chart.userId);
      map.set(key, cur);
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

  const currentSongsMap = aggregateSongsByUsers(weeklyEntries);
  const previousSongsMap = aggregateSongsByUsers(previousEntries);
  const currentSongsSorted = [...currentSongsMap.entries()]
    .map(([key, v]) => ({ key, title: v.title, artist: v.artist, spotifyId: v.spotifyId, artistSpotifyId: v.artistSpotifyId, users: v.users.size }))
    .sort((a, b) => b.users - a.users || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, 10);
  const prevSongsPosByKey = new Map(
    [...previousSongsMap.entries()]
      .map(([key, v]) => ({ key, users: v.users.size, title: v.title }))
      .sort((a, b) => b.users - a.users || a.title.localeCompare(b.title, "pt-BR"))
      .map((row, idx) => [row.key, idx + 1]),
  );
  const trendingSongs: SongWeekRow[] = currentSongsSorted.map((row, idx) => {
    const position = idx + 1;
    const prevPos = prevSongsPosByKey.get(row.key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: SongWeekRow["status"] =
      prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    return { title: row.title, artist: row.artist, spotifyId: row.spotifyId, artistSpotifyId: row.artistSpotifyId, users: row.users, status, delta };
  });

  const faq = buildFaq(t);

  return (
    <Shell title={t("discover.title")} subtitle={t("discover.subtitle")}>

      {/* ===== BLOCO EDITORIAL PRINCIPAL ===== */}
      <section style={{ marginBottom: 52, maxWidth: 820 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
          {t("discover.editorialTitle")}
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          {t("discover.editorialP1")}
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          {t("discover.editorialP2")}
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          {t("discover.editorialP3")}
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          {t("discover.editorialP4")}
        </p>
      </section>

      {/* ===== CURADORES EM DESTAQUE ===== */}
      <section style={{ marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>{t("discover.featuredCuratorsTitle")}</h2>
          <Link href="/discover/curators" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
            {t("discover.viewTop20")}
          </Link>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          {t("discover.featuredCuratorsIntro", { weekLabel: weekLabelDisplay })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {rankedCurators.map((row) => (
            <div key={row.user.id} style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar user={{ name: row.user.name, avatar: row.user.avatarColor }} imageUrl={row.user.image} size={72} />
                <div style={{
                  position: "absolute", bottom: -4, right: -4,
                  background: "var(--accent)", color: "white", fontSize: 11, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 8, border: "2px solid var(--surface)",
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  {t("discover.featuredBadge")}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{row.user.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{row.user.handle}</div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 6, lineHeight: 1.5, height: "2.8em", overflow: "hidden" }}>{row.user.bio ?? t("discover.featuredBioFallback")}</div>
                <Link href={`/chart/${row.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
                  {t("discover.viewChart")}
                </Link>
              </div>
              <FollowButton targetId={row.user.id} initialFollowing={followingIds.has(row.user.id)} variant="dark" size="sm" />
            </div>
          ))}
        </div>
      </section>

      {/* ===== GÊNEROS ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>{t("discover.exploreGenresTitle")}</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          {t("discover.exploreGenresIntro")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {GENRES.map((g) => (
            <Link
              key={g.name}
              href={`/discover/genre/${encodeURIComponent(g.slug)}`}
              style={{
                height: 120,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})`,
                padding: "20px 20px",
                color: "white",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                textDecoration: "none",
                border: "2px solid transparent",
                boxShadow: "none",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, position: "relative", zIndex: 1 }}>{g.name}</div>
              <div style={{
                position: "absolute", top: -10, right: -4,
                fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,0.15)",
                lineHeight: 1, userSelect: "none",
              }}>
                {g.letter}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== EM ALTA ===== */}
      <section style={{ marginBottom: 52 }}>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          {t("discover.hotIntro", { weekLabel: weekLabelDisplay })}
        </p>
        <HotTabs artists={trendingArtists} songs={trendingSongs} />
      </section>

      {/* ===== FAQ ===== */}
      <section
        style={{
          borderTop: "1px solid var(--divider)",
          paddingTop: 40,
          marginBottom: 8,
          maxWidth: 820,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} color="#FA243C" />
          {t("discover.faqTitle")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {faq.map((item, i) => (
            <div
              key={item.q}
              style={{
                borderTop: i === 0 ? "1px solid var(--divider)" : "none",
                borderBottom: "1px solid var(--divider)",
                padding: "20px 0",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.q}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
