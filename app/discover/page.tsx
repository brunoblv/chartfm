import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { HotTabs } from "./HotTabs";
import { getPreviousClosedWeekDate, getRankingWeekReference, buildWeekIndexFromDate } from "@/lib/chart-week";

function weeklyScore(likes: number, comments: number, reposts: number): number {
  return likes * 1 + comments * 2 + reposts * 3;
}

const GENRES = [
  { name: "Pop", color: ["#FA243C", "#FF5858"], letter: "P" },
  { name: "Hip-Hop/Rap", color: ["#1D1D1F", "#4A4A4F"], letter: "H" },
  { name: "Sertanejo", color: ["#E36414", "#FFD166"], letter: "S" },
  { name: "R&B/Soul", color: ["#6A0572", "#AB83A1"], letter: "R" },
  { name: "Indie/Alt", color: ["#06D6A0", "#073B4C"], letter: "I" },
  { name: "Funk", color: ["#EF476F", "#FFD166"], letter: "F" },
  { name: "Eletrônica", color: ["#8338EC", "#3A86FF"], letter: "E" },
  { name: "K-Pop", color: ["#FB5607", "#FFBE0B"], letter: "K" },
];

export default async function DiscoverPage() {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
  const prevWeekDate = new Date(getPreviousClosedWeekDate(nowBRT).getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekIndex = buildWeekIndexFromDate(prevWeekDate);

  return loadPageData(rankingWeek.weekIndex, rankingWeek.weekLabel, prevWeekIndex);
}

type ArtistWeekRow = {
  name: string;
  spotifyId?: string | null;
  listeners: number;
  users: number;
  status: "new" | "up" | "down" | "same";
  delta: number | null;
};

type SongWeekRow = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  users: number;
  status: "new" | "up" | "down" | "same";
  delta: number | null;
};

function normalizeArtistName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

async function loadPageData(weekIndex: number, weekLabel: string, prevWeekIndex: number) {
  const session = await getServerSession(authOptions);
  const [curatorCharts, followRows, weeklyEntries, previousEntries] = await Promise.all([
    prisma.chart.findMany({
      where: { weekIndex, isPublished: true },
      orderBy: [{ publishedAt: "asc" }],
      take: 5,
      select: {
        id: true,
        likes: true,
        comments: true,
        reposts: true,
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
            artistRef: { select: { name: true, spotifyId: true } },
          },
        },
      },
    }),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: prevWeekIndex, isPublished: true } },
      select: {
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
            artistRef: { select: { name: true, spotifyId: true } },
          },
        },
      },
    }),
  ]);

  const followingIds = new Set(followRows.map((r) => r.followingId));
  const rankedCurators = curatorCharts
    .map((row) => ({
      ...row,
      score: weeklyScore(row.likes, row.comments, row.reposts),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.likes !== a.likes) return b.likes - a.likes;
      if (b.comments !== a.comments) return b.comments - a.comments;
      return b.reposts - a.reposts;
    })
    .slice(0, 5);

  const aggregateArtists = (rows: typeof weeklyEntries) => {
    const map = new Map<string, { points: number; chartIds: Set<string>; userIds: Set<string>; spotifyId: string | null }>();
    for (const row of rows) {
      const name = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
      const sid = row.song.artistRef?.spotifyId ?? row.song.artistSpotifyId ?? null;
      const cur = map.get(name) ?? { points: 0, chartIds: new Set<string>(), userIds: new Set<string>(), spotifyId: null };
      cur.points += 1;
      cur.chartIds.add(row.chartId);
      cur.userIds.add(row.chart.userId);
      if (sid) cur.spotifyId = cur.spotifyId ?? sid;
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
    return { name: row.name, spotifyId: row.spotifyId, listeners: row.listeners, users: row.users, status, delta };
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

  return (
    <Shell title="Descobrir" subtitle="Explore músicas, artistas e curadores">
      {/* Curadores em destaque */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Curadores em destaque</h2>
          <Link href="/discover/curators" style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
            Ver top 20 →
          </Link>
        </div>
        <div style={{ fontSize: 12, color: "#86868B", marginBottom: 12 }}>Curadoria semanal em destaque ({weekLabel})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {rankedCurators.map((row) => (
            <div key={row.user.id} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar user={{ name: row.user.name, avatar: row.user.avatarColor }} imageUrl={row.user.image} size={72} />
                <div style={{
                  position: "absolute", bottom: -4, right: -4,
                  background: "#FA243C", color: "white", fontSize: 11, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 8, border: "2px solid white",
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  Destaque
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{row.user.name}</div>
                <div style={{ fontSize: 13, color: "#86868B" }}>@{row.user.handle}</div>
                <div style={{ fontSize: 13, color: "#6B6B70", marginTop: 6, lineHeight: 1.5, height: "2.8em", overflow: "hidden" }}>{row.user.bio ?? "Curador em destaque da semana."}</div>
                <Link href={`/chart/${row.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
                  Ver parada
                </Link>
              </div>
              <FollowButton targetId={row.user.id} initialFollowing={followingIds.has(row.user.id)} variant="dark" size="sm" />
            </div>
          ))}
        </div>
      </section>

      {/* Gêneros */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 20 }}>Explorar por gênero</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {GENRES.map((g) => (
            <div
              key={g.name}
              style={{
                height: 120,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})`,
                padding: "20px 20px",
                color: "white",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
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
            </div>
          ))}
        </div>
      </section>

      <div style={{ fontSize: 12, color: "#86868B", marginBottom: 12 }}>
        Ranking semanal atualizado na consolidação de segunda, 01:00 (BRT).
      </div>
      <HotTabs artists={trendingArtists} songs={trendingSongs} />
    </Shell>
  );
}
