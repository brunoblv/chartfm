import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { CommunityParadaWeekNav } from "@/components/community/CommunityParadaWeekNav";
import { GlobalHero } from "@/components/global/GlobalHero";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { loadCommunityHeader } from "@/lib/community-page-data";
import {
  computeCommunityChartData,
  getCommunityAvailableWeeks,
  parseCommunityPointsConfig,
} from "@/lib/community-chart";
import { getCommunityBySlug } from "@/lib/community-auth";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";

async function resolveArtistImages(artists: { name: string; spotifyId: string | null }[]) {
  const imageMap = new Map<string, string | null>();
  const spotifyIds = [...new Set(artists.map((a) => a.spotifyId).filter((x): x is string => Boolean(x)))];
  if (spotifyIds.length) {
    const byId = await prisma.artist.findMany({
      where: { spotifyId: { in: spotifyIds } },
      select: { spotifyId: true, imageUrl: true },
    });
    for (const a of artists) {
      if (!a.spotifyId) continue;
      const u = byId.find((r) => r.spotifyId === a.spotifyId)?.imageUrl;
      if (u) imageMap.set(a.name, u);
    }
  }
  for (const a of artists) {
    if (!imageMap.has(a.name)) imageMap.set(a.name, null);
  }
  return imageMap;
}

type CommunityParadaPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export default async function CommunityParadaPage({ params, searchParams }: CommunityParadaPageProps) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const sp = searchParams ? ("then" in searchParams ? await searchParams : searchParams) : {};
  const requestedWeek = Number(sp.week ?? "");

  const config = parseCommunityPointsConfig(row);
  const availableWeeks = await getCommunityAvailableWeeks(row.id);
  const availableWeekIndexes = availableWeeks.map((w) => w.weekIndex);

  const defaultWeekIndex =
    availableWeekIndexes[0] ?? getRankingWeekReference(new Date(), await getGlobalPublishSlot()).weekIndex;
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : defaultWeekIndex;

  const chart = await computeCommunityChartData(row.id, config, { weekIndex });

  const currentIndexInList = availableWeekIndexes.indexOf(chart.weekIndex);
  const newerWeek = currentIndexInList > 0 ? availableWeekIndexes[currentIndexInList - 1]! : null;
  const olderWeek =
    currentIndexInList >= 0 && currentIndexInList < availableWeekIndexes.length - 1
      ? availableWeekIndexes[currentIndexInList + 1]!
      : null;

  const previousWeek =
    olderWeek != null
      ? (availableWeeks.find((w) => w.weekIndex === olderWeek) ?? null)
      : null;
  const nextWeek =
    newerWeek != null
      ? (availableWeeks.find((w) => w.weekIndex === newerWeek) ?? null)
      : null;

  const basePath = `/community/${slug}/parada`;
  const pointsRule = chart.usesOfficialParada
    ? "Parada oficial da comunidade - histórico semanal importado."
    : "Ranking agregado a partir das paradas primárias dos membros.";
  const statPrimaryLabel = chart.usesOfficialParada
    ? `${chart.overallChartCount} semanas no histórico`
    : `${chart.contributorCount} paradas na semana`;

  const imageMap = await resolveArtistImages(
    [...chart.weeklyArtists, ...chart.overallArtists].map((a) => ({
      name: a.name,
      spotifyId: a.spotifyId,
    })),
  );

  const weeklyArtists = chart.weeklyArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));
  const overallArtists = chart.overallArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={community} activeTab="parada" />
      <div style={{ padding: "28px 40px 80px 40px" }}>
        <GlobalHero
          title={community.paradaName}
          basePath={basePath}
          weekNow={chart.weekLabel}
          weekRangeNow={chart.dateRange}
          songsCount={chart.weeklySongs.length}
          statPrimaryLabel={statPrimaryLabel}
          pointsRule={pointsRule}
          olderWeek={olderWeek}
          newerWeek={newerWeek}
        />
        <GlobalTabs
          weeklySongs={chart.weeklySongs}
          weeklyArtists={weeklyArtists}
          overallSongs={chart.overallSongs}
          overallArtists={overallArtists}
          weeklyDropouts={chart.weeklyDropouts}
          weekIndex={chart.weekIndex}
          communityId={row.id}
          overallPageSize={config.maxSongs}
          rankingLimit={config.maxSongs}
        />
      </div>
      <CommunityParadaWeekNav
        basePath={basePath}
        previousWeek={previousWeek}
        nextWeek={nextWeek}
      />
    </Shell>
  );
}
