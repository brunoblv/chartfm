import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { GlobalLastfmHero } from "@/components/global/GlobalLastfmHero";
import { GlobalLastfmRanking } from "@/components/global/GlobalLastfmRanking";
import { loadGlobalLastfmPageData } from "@/lib/global-lastfm-page";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type PageProps = {
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("global.airplayMetaTitle"),
    description: t("global.airplayMetaDescription"),
    alternates: { canonical: "/global/airplay" },
  };
}

export default async function GlobalAirplayPage({ searchParams }: PageProps) {
  const { t } = await getServerTranslations();
  const data = await loadGlobalLastfmPageData("airplay", searchParams);

  return (
    <Shell title={t("global.airplayTitle")} subtitle={t("global.airplaySubtitle")}>
      <Link
        href="/global"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 24,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        <ChevronLeft size={16} />
        {t("global.backToHub")}
      </Link>

      <GlobalLastfmHero
        title={t("global.airplayTitle")}
        pointsRule={t("global.airplayPointsRule")}
        basePath="/global/airplay"
        weekNow={data.weekLabel}
        weekRangeNow={data.scoringWindow || data.dateRange}
        contributorCount={data.contributorCount}
        entriesCount={data.entries.length}
        olderWeek={data.olderWeek}
        newerWeek={data.newerWeek}
        gradient="radial-gradient(circle at 30% 30%, #8338EC, #3A86FF)"
      />

      <section style={{ marginBottom: 52 }}>
        <GlobalLastfmRanking entries={data.entries} mode="airplay" emptyMessage={t("global.airplayEmpty")} />
      </section>
    </Shell>
  );
}
