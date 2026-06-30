import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { GlobalLastfmHero } from "@/components/global/GlobalLastfmHero";
import { GlobalLastfmRanking } from "@/components/global/GlobalLastfmRanking";
import { GlobalSpotifyPlaylistButton } from "@/components/global/GlobalSpotifyPlaylistButton";
import { loadGlobalLastfmPageData } from "@/lib/global-lastfm-page";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type PageProps = {
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("global.albumsMetaTitle"),
    description: t("global.albumsMetaDescription"),
    alternates: { canonical: "/global/albums" },
  };
}

export default async function GlobalAlbumsPage({ searchParams }: PageProps) {
  const { t } = await getServerTranslations();
  const data = await loadGlobalLastfmPageData("albums", searchParams);

  if (data.needsWeekRedirect) {
    redirect(`/global/albums?week=${data.weekIndex}`);
  }

  return (
    <Shell title={t("global.albumsTitle")} subtitle={t("global.albumsSubtitle")}>
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
        title={t("global.albumsTitle")}
        pointsRule={t("global.albumsPointsRule")}
        basePath="/global/albums"
        weekNow={data.weekLabel}
        weekRangeNow={data.scoringWindow || data.dateRange}
        contributorCount={data.contributorCount}
        entriesCount={data.entries.length}
        olderWeek={data.olderWeek}
        newerWeek={data.newerWeek}
        gradient="radial-gradient(circle at 30% 30%, #06D6A0, #073B4C)"
      />

      {data.entries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <GlobalSpotifyPlaylistButton
            kind="albums"
            weekIndex={data.weekIndex}
            returnPath={`/global/albums?week=${data.weekIndex}`}
          />
        </div>
      )}

      <section style={{ marginBottom: 52 }}>
        <GlobalLastfmRanking entries={data.entries} mode="albums" emptyMessage={t("global.albumsEmpty")} />
      </section>
    </Shell>
  );
}
