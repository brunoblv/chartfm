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
import { getLatestCuratorsSnapshot } from "@/lib/curators-snapshot";
import { MysteryTrackCard } from "@/components/discover/MysteryTrackCard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: `${t("discover.title")} | ChartFM`,
    description: t("discover.metaDescription"),
    alternates: { canonical: "/discover" },
  };
}

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
  const weekLabelDisplay = formatWeekLabel(locale, weekLabel);
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

  const tasteMatches = await getTasteMatches(session?.user?.id ?? null, myGenres?.genres ?? [], followingIds, 3);

  const rankedCurators = (curatorsSnapshot?.entries ?? []).slice(0, 5);
  const curatorsWeekLabelDisplay = formatWeekLabel(locale, curatorsSnapshot?.weekLabel ?? weekLabel);

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
      <section style={{ marginBottom: 52 }}>
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

      {/* ===== PESSOAS COM O SEU GOSTO ===== */}
      {tasteMatches.length > 0 && (
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px 0" }}>
            Pessoas com o seu gosto
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 18px 0", lineHeight: 1.6 }}>
            Calculado a partir dos gêneros que mais aparecem nas suas paradas.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {tasteMatches.map((match) => (
              <div
                key={match.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--divider)",
                  borderRadius: 18,
                  padding: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Avatar user={{ name: match.name, avatar: match.avatarColor }} imageUrl={match.image} size={44} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link
                      href={`/profile/${match.handle}`}
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      {match.name}
                    </Link>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>@{match.handle}</div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 800,
                      color: match.overlapPct >= 70 ? "#1B873F" : "#E09F00",
                    }}
                  >
                    {match.overlapPct}%
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {match.commonGenres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 100,
                        background: "var(--fill-subtle)",
                        color: "var(--text-subtle)",
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <FollowButton targetId={match.id} variant="dark" size="sm" label="Seguir" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== DESCUBRA MÚSICA NOVA ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px 0" }}>
          Descubra música nova
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 18px 0", lineHeight: 1.6 }}>
          Uma faixa por vez, tirada de paradas reais da comunidade — sem saber quem indicou até você reagir.
        </p>
        <MysteryTrackCard />
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Ao curtir, você vê o nome da música, quem colocou na parada dela/dele — e pode seguir na hora.
          </span>
        </div>
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
          {t("discover.featuredCuratorsIntro", { weekLabel: curatorsWeekLabelDisplay })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
          {rankedCurators.map((row) => (
            <div
              key={row.userId}
              style={{
                background: "var(--surface)",
                borderRadius: 18,
                border: "1px solid var(--divider)",
                padding: 18,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                textAlign: "center",
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar user={{ name: row.name, avatar: row.avatarColor }} imageUrl={row.image} size={52} />
                <div
                  style={{
                    position: "absolute",
                    bottom: -3,
                    right: -3,
                    background: "var(--accent)",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 5px",
                    borderRadius: 6,
                    border: "2px solid var(--surface)",
                  }}
                >
                  #{row.position}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{row.name}</div>
              <FollowButton
                targetId={row.userId}
                initialFollowing={followingIds.has(row.userId)}
                variant="outline"
                size="sm"
              />
            </div>
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
