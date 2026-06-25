import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { getRankingWeekReference } from "@/lib/chart-week";

export default async function CuratorsRankingPage() {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
  const session = await getServerSession(authOptions);

  const weekIndex = rankingWeek.weekIndex;
  const [charts, followRows] = await Promise.all([
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

  // Pontuação por atividade da pessoa na semana: criar parada = 100,
  // cada like dado em paradas = 5, cada comentário escrito = 25.
  const candidateUserIds = [...new Set(charts.map((c) => c.userId))];
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

  const byUser = new Map<string, { chartId: string; chartCount: number; user: (typeof charts)[number]["user"] }>();
  for (const c of charts) {
    const existing = byUser.get(c.userId);
    if (existing) existing.chartCount += 1;
    else byUser.set(c.userId, { chartId: c.id, chartCount: 1, user: c.user });
  }

  const rankedRows = [...byUser.values()]
    .map((row) => {
      const likesGiven = likesGivenByUser.get(row.user.id) ?? 0;
      const commentsWritten = commentsWrittenByUser.get(row.user.id) ?? 0;
      return {
        id: row.chartId,
        user: row.user,
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
    .slice(0, 20);

  return (
    <Shell title="Top 20 fãs de música" subtitle={`Ranking semanal · ${rankingWeek.weekLabel}`}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 14 }}>
          <Link href="/discover" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>
            ← Voltar para descobrir
          </Link>
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
          {rankedRows.map((row, i) => (
            <div
              key={row.user.id}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: i < rankedRows.length - 1 ? "1px solid var(--divider-soft)" : "none",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar user={{ name: row.user.name, avatar: row.user.avatarColor }} imageUrl={row.user.image} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Link href={`/profile/${row.user.handle}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                      {row.user.name}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{row.user.handle}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={`/chart/${row.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
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
