import { prisma } from "@/lib/prisma";
import { loadSongGlobalStatsFromSnapshots, lookupSongGlobal100Stats, type HistoricalStat } from "@/lib/global-snapshot";
import { resolvedChartEntryPoints } from "@/lib/chart-entry-points";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { parseSongSlug } from "@/lib/music-routes";
import type { SongPageSnapshotPayload } from "./types";

export async function computeSongPageSnapshot(
  slug: string,
  songGlobalStats?: Map<string, HistoricalStat>,
): Promise<SongPageSnapshotPayload | null> {
  const parsed = parseSongSlug(slug);
  if (!parsed) return null;

  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) return null;

  const entries = await prisma.chartEntry.findMany({
    where: { chart: publishedPrimaryParadaChartWhere, songId },
    select: {
      position: true,
      points: true,
      chart: {
        select: {
          userId: true,
          maxItems: true,
          _count: { select: { entries: true } },
          parada: { select: { isPrimary: true, cadence: true } },
        },
      },
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          albumRef: { select: { id: true, coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const songRow =
    entries[0]?.song ??
    (await prisma.song.findUnique({
      where: { id: songId },
      select: {
        title: true,
        artist: true,
        album: true,
        albumRef: { select: { id: true, coverUrl: true } },
        spotifyId: true,
        artistSpotifyId: true,
        artistRef: { select: { id: true } },
      },
    }));

  if (!songRow) return null;

  const first = entries[0];
  const title = songRow.title;
  const artist = songRow.artist;
  const globalRank = songGlobalStats ?? (await loadSongGlobalStatsFromSnapshots());
  const gs = lookupSongGlobal100Stats(
    { spotifyId: songRow.spotifyId, title, artist },
    globalRank,
  );

  const topUsersMap = new Map<string, { points: number }>();
  for (const e of entries) {
    const pts = resolvedChartEntryPoints({
      position: e.position,
      points: e.points,
      chart: {
        maxItems: e.chart.maxItems,
        entryCount: e.chart._count.entries,
        parada: e.chart.parada,
      },
    });
    const cur = topUsersMap.get(e.chart.userId) ?? { points: 0 };
    cur.points += pts;
    topUsersMap.set(e.chart.userId, cur);
  }
  const topUsersIds = [...topUsersMap.keys()];
  const topUsersRows = topUsersIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUsersIds } },
        select: { id: true, handle: true, name: true, avatarColor: true, image: true },
      })
    : [];
  const topUsersById = new Map(topUsersRows.map((u) => [u.id, u]));
  const topUsers = [...topUsersMap.entries()]
    .map(([userId, row]) => {
      const user = topUsersById.get(userId);
      if (!user) return null;
      return { user, points: row.points };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const totalPoints = entries.reduce(
    (sum, e) =>
      sum +
      resolvedChartEntryPoints({
        position: e.position,
        points: e.points,
        chart: {
          maxItems: e.chart.maxItems,
          entryCount: e.chart._count.entries,
          parada: e.chart.parada,
        },
      }),
    0,
  );

  return {
    builtAt: new Date().toISOString(),
    songId,
    title,
    artist,
    album: songRow.album ?? "",
    spotifyId: songRow.spotifyId,
    artistSpotifyId: songRow.artistSpotifyId,
    artistDbId: songRow.artistRef?.id ?? null,
    albumDbId: songRow.albumRef?.id ?? null,
    coverImageUrl: songRow.albumRef?.coverUrl?.trim() || null,
    paletteA: first?.coverPaletteA ?? "#FA243C",
    paletteB: first?.coverPaletteB ?? "#FFE66D",
    coverSeed: first?.coverSeed ?? 0,
    hasChartPresence: entries.length > 0,
    chartEntries: entries.length,
    globalStats: {
      totalPoints,
      uniqueUsers: new Set(entries.map((e) => e.chart.userId)).size,
      weeksTop100: gs.weeks,
      number1s: gs.numberOnes,
      peak: gs.peak,
    },
    topUsers,
  };
}
