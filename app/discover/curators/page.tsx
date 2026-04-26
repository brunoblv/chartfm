import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { getRankingWeekReference } from "@/lib/chart-week";

function weeklyScore(likes: number, comments: number, reposts: number): number {
  return likes * 1 + comments * 2 + reposts * 3;
}

export default async function CuratorsRankingPage() {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
  const session = await getServerSession(authOptions);

  const [rows, followRows] = await Promise.all([
    prisma.chart.findMany({
      where: { weekIndex: rankingWeek.weekIndex, isPublished: true },
      orderBy: [{ publishedAt: "asc" }],
      take: 20,
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
            avatarColor: true,
            image: true,
            bio: true,
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
  const rankedRows = rows
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
    .slice(0, 20);

  return (
    <Shell title="Top 20 curadores" subtitle={`Ranking por pontuação semanal · ${rankingWeek.weekLabel}`}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 14 }}>
          <Link href="/discover" style={{ color: "#86868B", textDecoration: "none", fontSize: 13 }}>
            ← Voltar para descobrir
          </Link>
        </div>
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {rankedRows.map((row, i) => (
            <div
              key={row.user.id}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: i < 3 ? "#FA243C" : "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar user={{ name: row.user.name, avatar: row.user.avatarColor }} imageUrl={row.user.image} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Link href={`/profile/${row.user.handle}`} style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F", textDecoration: "none" }}>
                      {row.user.name}
                    </Link>
                    <span style={{ fontSize: 12, color: "#86868B" }}>@{row.user.handle}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B6B70", marginTop: 2 }}>
                    🏆 {row.score} pts · 👍 {row.likes} · 💬 {row.comments} · 🔁 {row.reposts}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={`/chart/${row.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
                  Ver parada
                </Link>
                <FollowButton targetId={row.user.id} initialFollowing={followingIds.has(row.user.id)} variant="outline" size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
