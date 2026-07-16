import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { GlobalLastfmRanking } from "@/components/global/GlobalLastfmRanking";
import { GlobalLastfmHero } from "@/components/global/GlobalLastfmHero";
import { loadCommunityHeader } from "@/lib/community-page-data";
import { getOrCreateCommunityLastfmSnapshot } from "@/lib/community-lastfm";
import { getCommunityBySlug } from "@/lib/community-auth";
import { parseCommunityPointsConfig } from "@/lib/community-chart";

export default async function CommunityAlbumsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const config = parseCommunityPointsConfig(row);
  // Snapshot congelado da semana (create-only) — nunca recalcula em visita.
  const data = await getOrCreateCommunityLastfmSnapshot(row.id, "albums", config.maxSongs);

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={community} activeTab="albums" />
      <div style={{ padding: "28px 40px 80px 40px" }}>
        <GlobalLastfmHero
          title="Álbuns"
          pointsRule="Álbuns mais ouvidos pelos membros com Last.fm conectado (mesma regra do global)."
          basePath={`/community/${slug}/albums`}
          weekNow={data.weekLabel}
          weekRangeNow={data.scoringWindow || data.dateRange}
          contributorCount={data.contributorCount}
          entriesCount={data.entries.length}
          olderWeek={null}
          newerWeek={null}
          gradient="radial-gradient(circle at 70% 20%, #FF6B6B, #FA243C)"
        />
        <div style={{ marginTop: 24 }}>
          <GlobalLastfmRanking
            entries={data.entries}
            mode="albums"
            emptyMessage="Nenhum membro com Last.fm conectado ou sem álbuns ouvidos nesta semana."
          />
        </div>
      </div>
    </Shell>
  );
}
