import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { CuratorsRankingTable } from "@/components/discover/CuratorsRankingTable";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { formatWeekLabel } from "@/lib/i18n/format";
import type { CuratorRankingEntry } from "@/lib/curators-snapshot";
import {
  CURATOR_SCORE_CHART,
  CURATOR_SCORE_COMMENT,
  CURATOR_SCORE_LIKE,
} from "@/lib/curators-snapshot";

type PageProps = {
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export default async function CuratorsRankingPage({ searchParams }: PageProps) {
  const { t, locale } = await getServerTranslations();
  const params = searchParams ? ("then" in searchParams ? await searchParams : searchParams) : {};
  const requestedWeek = Number(params.week ?? "");
  const rankingWeek = getRankingWeekReference(new Date());
  const session = await getServerSession(authOptions);

  const availableSnapshots = await prisma.curatorsSnapshot.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
  });
  const availableWeekIndexes = availableSnapshots.map((row) => row.weekIndex);
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? null;

  const [snapshotRow, followRows] = await Promise.all([
    weekIndex !== null
      ? prisma.curatorsSnapshot.findUnique({ where: { weekIndex } })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.userFollow.findMany({
          where: { followerId: session.user.id },
          select: { followingId: true },
        })
      : Promise.resolve([] as Array<{ followingId: string }>),
  ]);

  const entries = (snapshotRow?.entries as CuratorRankingEntry[] | undefined) ?? [];
  const weekLabel = snapshotRow?.weekLabel ?? rankingWeek.weekLabel;
  const weekLabelDisplay = formatWeekLabel(locale, weekLabel);
  const followingIds = followRows.map((row) => row.followingId);

  return (
    <Shell title={t("discover.topCurators")} subtitle={t("discover.weeklyRanking", { label: weekLabelDisplay })}>
      <div style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 14 }}>
          <Link href="/discover" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>
            {t("discover.backToDiscover")}
          </Link>
        </div>

        <section
          style={{
            marginBottom: 24,
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 18,
            padding: "20px 22px",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            {t("discover.curatorsScoringTitle")}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)", margin: "0 0 12px" }}>
            {t("discover.curatorsScoringIntro", { weekLabel: weekLabelDisplay })}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: "var(--text-muted)" }}>
            <li>{t("discover.curatorsScoringChart", { points: CURATOR_SCORE_CHART })}</li>
            <li>{t("discover.curatorsScoringLike", { points: CURATOR_SCORE_LIKE })}</li>
            <li>{t("discover.curatorsScoringComment", { points: CURATOR_SCORE_COMMENT })}</li>
          </ul>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-subtle)", margin: "12px 0 0" }}>
            {t("discover.curatorsScoringFrozen")}
          </p>
        </section>

        <CuratorsRankingTable entries={entries} followingIds={followingIds} />
      </div>
    </Shell>
  );
}
