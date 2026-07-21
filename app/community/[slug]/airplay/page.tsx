import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { GlobalLastfmRanking } from "@/components/global/GlobalLastfmRanking";
import { GlobalLastfmHero } from "@/components/global/GlobalLastfmHero";
import { loadCommunityHeader } from "@/lib/community-page-data";
import { getOrCreateCommunityLastfmSnapshot } from "@/lib/community-lastfm";
import { getCommunityBySlug } from "@/lib/community-auth";
import { parseCommunityPointsConfig } from "@/lib/community-chart";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export default async function CommunityAirplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getServerTranslations();
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const config = parseCommunityPointsConfig(row);
  // Snapshot congelado da semana (create-only) — nunca recalcula em visita.
  const data = await getOrCreateCommunityLastfmSnapshot(row.id, "airplay", config.maxSongs);

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={community} activeTab="airplay" />
      <div style={{ padding: "28px 40px 80px 40px" }}>
        <GlobalLastfmHero
          title={t("communities.airplayTitle")}
          pointsRule={t("communities.airplayPointsRule")}
          basePath={`/community/${slug}/airplay`}
          weekNow={data.weekLabel}
          weekRangeNow={data.scoringWindow || data.dateRange}
          contributorCount={data.contributorCount}
          entriesCount={data.entries.length}
          olderWeek={null}
          newerWeek={null}
          gradient="radial-gradient(circle at 30% 30%, #8338EC, #3A86FF)"
        />
        <div style={{ marginTop: 24 }}>
          <GlobalLastfmRanking
            entries={data.entries}
            mode="airplay"
            emptyMessage={t("communities.airplayEmpty")}
          />
        </div>
      </div>
    </Shell>
  );
}
