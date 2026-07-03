import { prisma } from "@/lib/prisma";
import { getRankingWeekReference, prevChartWeekIndex } from "@/lib/chart-week";
import {
  aggregateGlobalSongs,
  aggregateTopArtists,
  type WeeklyChartEntryRow,
} from "@/lib/weekly-chart-aggregate";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";

export type CommunityPointsConfig = {
  maxSongs: number;
  memberPositionLimit: number | null;
  pointsMode: "member" | "custom";
  customPoints: number[] | null;
};

export function parseCommunityPointsConfig(community: {
  maxSongs: number;
  memberPositionLimit: number | null;
  pointsMode: string;
  customPoints: unknown;
}): CommunityPointsConfig {
  let customPoints: number[] | null = null;
  if (Array.isArray(community.customPoints)) {
    customPoints = community.customPoints
      .map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0))
      .filter((_, i, arr) => i < arr.length);
    if (!customPoints.length) customPoints = null;
  }
  return {
    maxSongs: Math.min(Math.max(community.maxSongs, 10), 100),
    memberPositionLimit:
      community.memberPositionLimit != null && community.memberPositionLimit > 0
        ? Math.min(community.memberPositionLimit, 100)
        : null,
    pointsMode: community.pointsMode === "custom" ? "custom" : "member",
    customPoints,
  };
}

const entrySelect = {
  position: true,
  points: true,
  chartId: true,
  coverPaletteA: true,
  coverPaletteB: true,
  coverSeed: true,
  song: {
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      albumRef: { select: { id: true, coverUrl: true } },
      spotifyId: true,
      artistSpotifyId: true,
      artistRef: { select: { id: true, spotifyId: true, name: true } },
      feats: { select: { artist: { select: { spotifyId: true, name: true } } } },
    },
  },
} as const;

function applyCommunityPointRules(
  entries: WeeklyChartEntryRow[],
  config: CommunityPointsConfig,
): WeeklyChartEntryRow[] {
  let filtered = entries;
  if (config.memberPositionLimit != null) {
    filtered = entries.filter((e) => e.position <= config.memberPositionLimit!);
  }
  if (config.pointsMode === "custom" && config.customPoints?.length) {
    return filtered.map((e) => ({
      ...e,
      points: config.customPoints![e.position - 1] ?? 0,
    }));
  }
  return filtered;
}

async function loadMemberChartEntries(
  memberIds: string[],
  weekIndex?: number,
): Promise<WeeklyChartEntryRow[]> {
  if (!memberIds.length) return [];
  const where = {
    chart: {
      userId: { in: memberIds },
      ...(weekIndex != null ? { weekIndex } : {}),
      ...publishedPrimaryParadaChartWhere,
    },
    position: { lte: 100 },
  };
  return prisma.chartEntry.findMany({
    where,
    select: entrySelect,
  });
}

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

export type CommunityChartPayload = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  contributorCount: number;
  /** Nº de paradas distintas de membros já contabilizadas no ranking geral da comunidade (histórico completo). */
  overallChartCount: number;
  weeklySongs: GlobalSnapshotPayload["weeklySongs"];
  weeklyArtists: GlobalSnapshotPayload["weeklyArtists"];
  overallSongs: GlobalSnapshotPayload["overallSongs"];
  overallArtists: GlobalSnapshotPayload["overallArtists"];
  weeklyDropouts: GlobalSnapshotPayload["weeklySongs"];
};

export async function computeCommunityChartData(
  communityId: string,
  config: CommunityPointsConfig,
  referenceDate: Date = new Date(),
): Promise<CommunityChartPayload> {
  const rankingWeek = getRankingWeekReference(referenceDate);
  const weekIndex = rankingWeek.weekIndex;
  const prevWeek = prevChartWeekIndex(weekIndex);

  const memberIds = await prisma.communityMember.findMany({
    where: { communityId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);

  const [weeklyRaw, prevWeeklyRaw, overallRaw] = await Promise.all([
    loadMemberChartEntries(userIds, weekIndex),
    loadMemberChartEntries(userIds, prevWeek),
    loadMemberChartEntries(userIds),
  ]);

  const weeklyEntries = applyCommunityPointRules(weeklyRaw, config);
  const prevWeeklyEntries = applyCommunityPointRules(prevWeeklyRaw, config);
  const overallEntries = applyCommunityPointRules(overallRaw, config);

  const limit = config.maxSongs;
  const contributorCount = new Set(weeklyRaw.map((e) => e.chartId)).size;
  const overallChartCount = new Set(overallRaw.map((e) => e.chartId)).size;

  const weeklySongs = aggregateGlobalSongs(weeklyEntries, limit, {
    previousWeekEntries: prevWeeklyEntries,
    weightMode: "stored",
  });
  const weeklyArtists = aggregateTopArtists(weeklyEntries, limit, {
    previousWeekEntries: prevWeeklyEntries,
    weightMode: "stored",
  });
  const overallSongs = aggregateGlobalSongs(overallEntries, limit, { weightMode: "stored" });
  const overallArtists = aggregateTopArtists(overallEntries, limit, { weightMode: "stored" });

  function songKey(song: { spotifyId?: string | null; title: string; artist: string }): string {
    if (song.spotifyId) return `spotify:${song.spotifyId}`;
    return `local:${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`;
  }
  const currentKeySet = new Set(weeklySongs.map((s) => songKey(s.song)));
  const prevWeeklySongs = aggregateGlobalSongs(prevWeeklyEntries, limit, { weightMode: "stored" });
  const weeklyDropoutsRaw = prevWeeklySongs.filter((s) => !currentKeySet.has(songKey(s.song)));

  const [hydratedWeekly, hydratedOverall, hydratedDropouts] = await Promise.all([
    hydrateSongCovers(weeklySongs),
    hydrateSongCovers(overallSongs),
    hydrateSongCovers(weeklyDropoutsRaw),
  ]);

  return {
    weekIndex,
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
    contributorCount,
    overallChartCount,
    weeklySongs: hydratedWeekly,
    weeklyArtists,
    overallSongs: hydratedOverall,
    overallArtists,
    weeklyDropouts: hydratedDropouts,
  };
}
