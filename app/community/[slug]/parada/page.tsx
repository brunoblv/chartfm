import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { loadCommunityHeader } from "@/lib/community-page-data";
import { computeCommunityChartData, parseCommunityPointsConfig } from "@/lib/community-chart";
import { getCommunityBySlug } from "@/lib/community-auth";

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

export default async function CommunityParadaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const config = parseCommunityPointsConfig(row);
  const chart = await computeCommunityChartData(row.id, config);

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
        <p style={{ fontSize: 14, color: "#86868B", marginBottom: 20, lineHeight: 1.6 }}>
          {community.paradaName} agregada a partir das paradas primárias de{" "}
          <strong>{chart.contributorCount}</strong> membros na semana {chart.dateRange}.
        </p>
        <GlobalTabs
          weeklySongs={chart.weeklySongs}
          weeklyArtists={weeklyArtists}
          overallSongs={chart.overallSongs}
          overallArtists={overallArtists}
          weeklyDropouts={chart.weeklyDropouts}
        />
      </div>
    </Shell>
  );
}
