import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { buildWeekIndexFromDate, getPreviousClosedWeekDate, getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { getSpotifyArtistById, searchSpotifyArtist, spotifyConfigured } from "@/lib/spotify-server";
import {
  aggregateGlobalSongs,
  aggregateTopArtists,
  type WeeklyChartEntryRow,
} from "@/lib/weekly-chart-aggregate";

async function loadWeeklyGlobalEntries(weekIdx: number): Promise<WeeklyChartEntryRow[]> {
  return prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx } },
    select: {
      position: true,
      points: true,
      chartId: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { spotifyId: true, name: true } },
        },
      },
    },
  });
}

async function loadHistoricalSongStats(upToWeekIdx: number): Promise<Map<string, { peak: number; weeks: number }>> {
  const rows = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: { lte: upToWeekIdx } } },
    select: {
      position: true,
      chart: { select: { weekIndex: true } },
      song: { select: { spotifyId: true, title: true, artist: true } },
    },
  });

  const map = new Map<string, { peak: number; weeks: Set<number> }>();
  for (const r of rows) {
    const key = r.song.spotifyId
      ? `song_spotify:${r.song.spotifyId}`
      : `song_local:${r.song.title.trim().replace(/\s+/g, " ").toLowerCase()}|${r.song.artist
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase()}`;
    const cur = map.get(key) ?? { peak: r.position, weeks: new Set<number>() };
    cur.peak = Math.min(cur.peak, r.position);
    cur.weeks.add(r.chart.weekIndex);
    map.set(key, cur);
  }

  return new Map(
    [...map.entries()].map(([k, v]) => [k, { peak: v.peak, weeks: v.weeks.size }])
  );
}

async function loadHistoricalArtistStats(upToWeekIdx: number): Promise<Map<string, { peak: number; weeks: number }>> {
  const rows = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: { lte: upToWeekIdx } } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: {
        select: {
          artist: true,
          artistSpotifyId: true,
          artistRef: { select: { spotifyId: true } },
        },
      },
    },
  });

  const weekArtistPoints = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const sid = r.song.artistRef?.spotifyId ?? r.song.artistSpotifyId;
    const key = sid
      ? `artist_spotify:${sid}`
      : `artist_name:${r.song.artist.trim().replace(/\s+/g, " ").toLowerCase()}`;
    const weekMap = weekArtistPoints.get(key) ?? new Map<number, number>();
    const pts = r.points > 0 ? r.points : 101 - r.position;
    weekMap.set(r.chart.weekIndex, (weekMap.get(r.chart.weekIndex) ?? 0) + pts);
    weekArtistPoints.set(key, weekMap);
  }

  const stats = new Map<string, { peak: number; weeks: number }>();
  const weeklyRanks = new Map<number, { key: string; pts: number }[]>();
  for (const [artistKey, wkMap] of weekArtistPoints) {
    for (const [wk, pts] of wkMap) {
      const arr = weeklyRanks.get(wk) ?? [];
      arr.push({ key: artistKey, pts });
      weeklyRanks.set(wk, arr);
    }
  }
  for (const [wk, arr] of weeklyRanks) {
    const sorted = arr.sort((a, b) => b.pts - a.pts);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const cur = stats.get(a.key) ?? { peak: i + 1, weeks: 0 };
      cur.peak = Math.min(cur.peak, i + 1);
      cur.weeks += 1;
      stats.set(a.key, cur);
    }
  }

  return stats;
}

type ArtistImageKey = { name: string; spotifyId: string | null };

function isMissingImageUrl(url: string | null | undefined): boolean {
  return url === undefined || url === null || url === "";
}

async function resolveArtistImages(artists: ArtistImageKey[]): Promise<Map<string, string | null>> {
  const imageMap = new Map<string, string | null>();

  const spotifyIds = [...new Set(artists.map((a) => a.spotifyId).filter((x): x is string => Boolean(x)))];
  if (spotifyIds.length) {
    const byId = await prisma.artist.findMany({
      where: { spotifyId: { in: spotifyIds } },
      select: { spotifyId: true, imageUrl: true },
    });
    const idToUrl = new Map(byId.map((r) => [r.spotifyId, r.imageUrl]));
    for (const a of artists) {
      if (!a.spotifyId) continue;
      const u = idToUrl.get(a.spotifyId);
      if (!isMissingImageUrl(u ?? undefined)) imageMap.set(a.name, u!);
    }
  }

  const names = [...new Set(artists.map((a) => a.name))];
  const byName = names.length
    ? await prisma.artist.findMany({
        where: { name: { in: names } },
        select: { name: true, imageUrl: true },
      })
    : [];
  const nameToUrl = new Map(byName.map((r) => [r.name, r.imageUrl]));

  for (const a of artists) {
    if (!isMissingImageUrl(imageMap.get(a.name))) continue;
    const fromName = nameToUrl.get(a.name);
    if (!isMissingImageUrl(fromName ?? undefined)) imageMap.set(a.name, fromName!);
  }

  for (const a of artists) {
    if (!imageMap.has(a.name)) imageMap.set(a.name, null);
  }

  if (!spotifyConfigured()) return imageMap;

  const missing = artists.filter((a) => isMissingImageUrl(imageMap.get(a.name)));
  const CHUNK = 10;
  for (let i = 0; i < missing.length; i += CHUNK) {
    await Promise.all(
      missing.slice(i, i + CHUNK).map(async (a) => {
        const fromId = a.spotifyId ? await getSpotifyArtistById(a.spotifyId) : null;
        const result = fromId ?? (await searchSpotifyArtist(a.name));
        const url = result?.imageUrl ?? null;
        imageMap.set(a.name, url);
        if (result) {
          await prisma.artist.upsert({
            where: { spotifyId: result.spotifyId },
            create: {
              spotifyId: result.spotifyId,
              name: result.name,
              imageUrl: result.imageUrl,
              spotifyUrl: result.spotifyUrl,
            },
            update: {
              name: result.name,
              spotifyUrl: result.spotifyUrl ?? undefined,
              ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
            },
          });
        }
      })
    );
  }
  return imageMap;
}

export default async function GlobalPage() {
  const rankingWeek = getRankingWeekReference(new Date());
  const weekNow = rankingWeek.weekLabel;
  const weekRangeNow = rankingWeek.dateRange;
  const weekIdx = rankingWeek.weekIndex;

  const prevWeekIdx = buildWeekIndexFromDate(
    new Date(getPreviousClosedWeekDate(new Date()).getTime() - 7 * 24 * 60 * 60 * 1000)
  );

  const [weeklyEntries, prevWeekEntries, historicalSongStats, historicalArtistStats] = await Promise.all([
    loadWeeklyGlobalEntries(weekIdx),
    loadWeeklyGlobalEntries(prevWeekIdx),
    loadHistoricalSongStats(weekIdx),
    loadHistoricalArtistStats(weekIdx),
  ]);
  const [overallEntries, prevOverallEntries] = await Promise.all([
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: { lte: weekIdx } } },
      select: {
        position: true,
        points: true,
        chartId: true,
        coverPaletteA: true,
        coverPaletteB: true,
        coverSeed: true,
        song: {
          select: {
            title: true,
            artist: true,
            album: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { spotifyId: true, name: true } },
          },
        },
      },
    }),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: { lte: prevWeekIdx } } },
      select: {
        position: true,
        points: true,
        chartId: true,
        coverPaletteA: true,
        coverPaletteB: true,
        coverSeed: true,
        song: {
          select: {
            title: true,
            artist: true,
            album: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { spotifyId: true, name: true } },
          },
        },
      },
    }),
  ]);
  const uniqueParadas = new Set(weeklyEntries.map((e) => e.chartId)).size;
  const globalSongs = aggregateGlobalSongs(weeklyEntries, 100, {
    previousWeekEntries: prevWeekEntries,
    historicalStatsBySongKey: historicalSongStats,
    comparisonEntries: prevWeekEntries,
  });
  const overallSongs = aggregateGlobalSongs(overallEntries, 100, {
    previousWeekEntries: prevOverallEntries,
    historicalStatsBySongKey: historicalSongStats,
    comparisonEntries: prevOverallEntries,
  });
  const topArtists = aggregateTopArtists(weeklyEntries, 100, {
    previousWeekEntries: prevWeekEntries,
    historicalStatsByArtistKey: historicalArtistStats,
    comparisonEntries: prevWeekEntries,
  });
  const topArtistsOverall = aggregateTopArtists(overallEntries, 100, {
    previousWeekEntries: prevOverallEntries,
    historicalStatsByArtistKey: historicalArtistStats,
    comparisonEntries: prevOverallEntries,
  });
  const imageMap = await resolveArtistImages(
    [...topArtists, ...topArtistsOverall].map((a) => ({ name: a.name, spotifyId: a.spotifyId }))
  );
  const topArtistsWithImages = topArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));
  const topArtistsOverallWithImages = topArtistsOverall.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));

  return (
    <Shell title="Parada Global" subtitle="A parada agregada de toda a plataforma">
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 100%)",
        borderRadius: 20,
        padding: "48px 48px",
        marginBottom: 40,
        display: "flex",
        gap: 40,
        alignItems: "center",
        color: "white",
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 20, flexShrink: 0,
          background: "radial-gradient(circle at 30% 30%, #FA243C, #FF5858)",
          boxShadow: "0 16px 40px rgba(250,36,60,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>{weekNow}</div>
          <h1 style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>Parada Global</h1>
          <p style={{ fontSize: 15, opacity: 0.8, maxWidth: 480, lineHeight: 1.6, marginBottom: 16 }}>
            Cada música ganha <strong>101 − posição</strong> pontos por parada em que aparece. A soma decide o ranking semanal global.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 14, opacity: 0.7 }}>
            <span>{uniqueParadas} paradas consideradas</span>
            <span>·</span>
            <span>{globalSongs.length} músicas</span>
            <span>·</span>
            <span>{weekRangeNow}</span>
          </div>
        </div>
      </div>

      <GlobalTabs
        weeklySongs={globalSongs}
        weeklyArtists={topArtistsWithImages}
        overallSongs={overallSongs}
        overallArtists={topArtistsOverallWithImages}
      />
    </Shell>
  );
}
