import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { GlobalHero } from "@/components/global/GlobalHero";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import { computeGlobalGenreChartData } from "@/lib/global-genre-chart";
import {
  formatGenreChartTags,
  getGlobalGenreChart,
  GLOBAL_GENRE_CHARTS,
  isGlobalGenreChartSlug,
} from "@/lib/global-genre-charts";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { ChevronLeft } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type GlobalSongLike = GlobalSnapshotPayload["weeklySongs"][number];

async function hydrateSongCovers(entries: GlobalSongLike[]): Promise<GlobalSongLike[]> {
  if (!entries.length) return entries;
  const songIds = [...new Set(entries.map((e) => e.song.id).filter((id): id is string => Boolean(id)))];
  const coverBySongId = songIds.length > 0 ? await loadCoverUrlsForSongIds(prisma, songIds) : new Map();
  return entries.map((entry) => {
    const id = entry.song.id;
    const imageUrl =
      (id ? coverBySongId.get(id) ?? null : null) ||
      entry.song.imageUrl?.trim() ||
      entry.cover.imageUrl?.trim() ||
      null;
    return {
      ...entry,
      song: { ...entry.song, imageUrl },
      cover: { ...entry.cover, imageUrl },
    };
  });
}

async function resolveArtistImages(
  artists: Array<{ name: string; spotifyId: string | null }>,
): Promise<Map<string, string | null>> {
  const imageMap = new Map<string, string | null>();
  const spotifyIds = [...new Set(artists.map((a) => a.spotifyId).filter((x): x is string => Boolean(x)))];
  if (spotifyIds.length) {
    const byId = await prisma.artist.findMany({
      where: { spotifyId: { in: spotifyIds } },
      select: { spotifyId: true, imageUrl: true },
    });
    for (const row of byId) {
      if (row.imageUrl) {
        for (const a of artists) {
          if (a.spotifyId === row.spotifyId) imageMap.set(a.name, row.imageUrl);
        }
      }
    }
  }
  for (const a of artists) {
    if (!imageMap.has(a.name)) imageMap.set(a.name, null);
  }
  return imageMap;
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export async function generateStaticParams() {
  return GLOBAL_GENRE_CHARTS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const chart = getGlobalGenreChart(slug);
  if (!chart) return { title: "Parada Global | ChartFM" };
  return {
    title: `${chart.name} | ChartFM`,
    description: chart.description,
    alternates: { canonical: `/global/genre/${slug}` },
  };
}

export default async function GlobalGenreChartPage({ params, searchParams }: PageProps) {
  const { t } = await getServerTranslations();
  const { slug } = await params;
  if (!isGlobalGenreChartSlug(slug)) notFound();
  const chart = getGlobalGenreChart(slug)!;

  const sp = searchParams ? ("then" in searchParams ? await searchParams : searchParams) : {};
  const requestedWeek = Number(sp.week ?? "");
  const rankingWeek = getRankingWeekReference(new Date());

  const availableSnapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
  });
  const availableWeekIndexes = availableSnapshots.map((w) => w.weekIndex);
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? rankingWeek.weekIndex;
  const currentMeta = availableSnapshots.find((w) => w.weekIndex === weekIndex) ?? null;

  const payload = await computeGlobalGenreChartData(weekIndex, slug);
  const weekNow = currentMeta?.weekLabel ?? rankingWeek.weekLabel;
  const weekRangeNow = currentMeta?.dateRange ?? rankingWeek.dateRange;

  const globalSongs = await hydrateSongCovers(payload.weeklySongs);
  const overallSongs = await hydrateSongCovers(payload.overallSongs);

  const imageMap = await resolveArtistImages([
    ...payload.weeklyArtists,
    ...payload.overallArtists,
  ].map((a) => ({ name: a.name, spotifyId: a.spotifyId })));

  const topArtistsWithImages = payload.weeklyArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));
  const topArtistsOverallWithImages = payload.overallArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));

  const currentIndexInList = availableWeekIndexes.indexOf(weekIndex);
  const newerWeek = currentIndexInList > 0 ? availableWeekIndexes[currentIndexInList - 1] : null;
  const olderWeek =
    currentIndexInList >= 0 && currentIndexInList < availableWeekIndexes.length - 1
      ? availableWeekIndexes[currentIndexInList + 1]
      : null;

  const uniqueParadas = await prisma.chart.count({
    where: { weekIndex, parada: { isPrimary: true } },
  });

  const basePath = `/global/genre/${slug}`;

  return (
    <Shell title={chart.name} subtitle={t("global.subtitle")}>
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
        Todas as paradas globais
      </Link>

      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-muted)", margin: "0 0 12px" }}>
          {chart.description}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-muted)", margin: 0 }}>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>Subgêneros incluídos: </span>
          {formatGenreChartTags(chart, 32)}
          {chart.tags.length > 32 ? "…" : ""}
        </p>
      </section>

      <GlobalHero
        title={chart.name}
        pointsRule="Apenas músicas com tags deste gênero entram no ranking. Pontos das paradas pessoais da comunidade."
        basePath={basePath}
        weekNow={weekNow}
        weekRangeNow={weekRangeNow}
        statPrimaryLabel={t("global.chartsCount", { count: uniqueParadas })}
        songsCount={globalSongs.length}
        olderWeek={olderWeek}
        newerWeek={newerWeek}
      />

      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
          Rankings da semana {weekNow}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Top 50 filtrado por tags da faixa (MusicBrainz / Last.fm). Semanas: {weekRangeNow}.
        </p>

        {globalSongs.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderRadius: 14,
              padding: 32,
              fontSize: 14,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            Nenhuma música deste gênero nas paradas desta semana. Rode o backfill de tags em{" "}
            <Link href="/admin/song-genres" style={{ color: "var(--accent)", fontWeight: 600 }}>
              /admin/song-genres
            </Link>{" "}
            para melhorar a cobertura.
          </div>
        ) : (
          <GlobalTabs
            weeklySongs={globalSongs}
            weeklyArtists={topArtistsWithImages}
            overallSongs={overallSongs}
            overallArtists={topArtistsOverallWithImages}
            weeklyDropouts={[]}
            spotifyPlaylist={{
              kind: "genre",
              weekIndex,
              genreSlug: slug,
              returnPath: `${basePath}?week=${weekIndex}`,
            }}
          />
        )}
      </section>
    </Shell>
  );
}
