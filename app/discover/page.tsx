import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { FollowButton } from "@/components/ui/FollowButton";
import { ARTISTS, COVER_PALETTES } from "@/lib/data";
import { getRankingWeekReference } from "@/lib/chart-week";

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
  const trendingArtists = ARTISTS.slice(0, 10);
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);

  return loadPageData(rankingWeek.weekIndex, rankingWeek.weekLabel, trendingArtists);
}

async function loadPageData(weekIndex: number, weekLabel: string, trendingArtists: typeof ARTISTS) {
  const session = await getServerSession(authOptions);
  const [curatorCharts, followRows] = await Promise.all([
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
        <div style={{ fontSize: 12, color: "#86868B", marginBottom: 12 }}>Pontuação semanal ({weekLabel}): likes x1, comentários x2, republicações x3</div>
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
                  🏆 {row.score}
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

      {/* Artistas em alta */}
      <section>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 20 }}>Artistas em alta</h2>
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 60px 1fr 120px 120px 100px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            {["#", "", "Artista", "Ouvintes", "Pontos", "Tendência"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "4px 8px" }}>{h}</div>
            ))}
          </div>
          {trendingArtists.map((a, i) => (
            <Link key={a.name} href={`/artist/${encodeURIComponent(a.name)}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "40px 60px 1fr 120px 120px 100px",
                alignItems: "center",
                padding: "8px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#000000", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{i + 1}</div>
                <div style={{ padding: "4px 8px" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COVER_PALETTES[i % COVER_PALETTES.length][0]}, ${COVER_PALETTES[i % COVER_PALETTES.length][1]})`,
                  }} />
                </div>
                <div style={{ padding: "0 8px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                </div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{a.listeners}</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{a.totalPoints}</div>
                <div style={{ padding: "0 8px" }}>
                  <MovementBadge status={i % 3 === 0 ? "up" : i % 3 === 1 ? "down" : "same"} delta={i % 3 === 0 ? i + 1 : -(i + 1)} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
