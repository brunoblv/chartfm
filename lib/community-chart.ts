import { prisma } from "@/lib/prisma";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  buildDateRangeFromDate,
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
  prevChartWeekIndex,
} from "@/lib/chart-week";
import {
  aggregateGlobalSongs,
  aggregateTopArtists,
  artistDisplayName,
  type WeeklyChartEntryRow,
} from "@/lib/weekly-chart-aggregate";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import type { GlobalChartEntry } from "@/lib/types";

/** Limite do ranking geral (overall) — paginado na UI da comunidade. */
export const COMMUNITY_OVERALL_RANKING_LIMIT = 5000;

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

const officialEntrySelect = {
  ...entrySelect,
  status: true,
  delta: true,
  prevPos: true,
  peak: true,
  weeks: true,
} as const;

type OfficialChartEntryRow = WeeklyChartEntryRow & {
  status: string;
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
};

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

async function communityHasOfficialCharts(communityId: string): Promise<boolean> {
  const chart = await prisma.chart.findFirst({
    where: { communityId, isPublished: true },
    select: { id: true },
  });
  return chart != null;
}

export type CommunityChartWeekMeta = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
};

export type ComputeCommunityChartOptions = {
  /** Semana explicitamente solicitada (ex.: query `?week=`). */
  weekIndex?: number;
  referenceDate?: Date;
};

export async function getCommunityAvailableWeeks(
  communityId: string,
): Promise<CommunityChartWeekMeta[]> {
  if (await communityHasOfficialCharts(communityId)) {
    return prisma.chart.findMany({
      where: { communityId, isPublished: true },
      select: { weekIndex: true, weekLabel: true, dateRange: true },
      orderBy: { weekIndex: "desc" },
    });
  }

  const memberIds = await prisma.communityMember.findMany({
    where: { communityId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);
  if (!userIds.length) return [];

  const charts = await prisma.chart.findMany({
    where: {
      userId: { in: userIds },
      ...publishedPrimaryParadaChartWhere,
    },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
  });

  const byWeek = new Map<number, CommunityChartWeekMeta>();
  for (const chart of charts) {
    if (!byWeek.has(chart.weekIndex)) byWeek.set(chart.weekIndex, chart);
  }
  return [...byWeek.values()].sort((a, b) => b.weekIndex - a.weekIndex);
}

async function weekMetaFromIndex(weekIndex: number): Promise<Pick<CommunityChartWeekMeta, "weekLabel" | "dateRange">> {
  const ref = getWeeklySnapshotReferenceDate(weekIndex, await getGlobalPublishSlot());
  return {
    weekLabel: buildWeekLabelFromDate(ref),
    dateRange: buildDateRangeFromDate(ref),
  };
}

async function loadOfficialCommunityChartEntries(
  communityId: string,
  weekIndex?: number,
): Promise<OfficialChartEntryRow[]> {
  return prisma.chartEntry.findMany({
    where: {
      chart: {
        communityId,
        isPublished: true,
        ...(weekIndex != null ? { weekIndex } : {}),
      },
      position: { lte: 100 },
    },
    select: officialEntrySelect,
    orderBy: { position: "asc" },
  });
}

async function resolveOfficialCommunityWeekChart(
  communityId: string,
  requestedWeekIndex?: number,
) {
  if (requestedWeekIndex != null) {
    return prisma.chart.findFirst({
      where: { communityId, weekIndex: requestedWeekIndex, isPublished: true },
      select: { weekIndex: true, weekLabel: true, dateRange: true },
    });
  }

  return prisma.chart.findFirst({
    where: { communityId, isPublished: true },
    orderBy: { weekIndex: "desc" },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
  });
}

function mapOfficialEntriesToGlobalSongs(entries: OfficialChartEntryRow[]): GlobalChartEntry[] {
  return entries.map((e) => {
    const s = e.song;
    const manualCover = s.albumRef?.coverUrl?.trim() || null;
    const status = e.status as GlobalChartEntry["status"];
    return {
      position: e.position,
      song: {
        id: s.id,
        title: s.title,
        artist: artistDisplayName(s),
        slugArtist: s.artist,
        album: s.album ?? "",
        spotifyId: s.spotifyId ?? null,
        artistSpotifyId: s.artistSpotifyId ?? null,
        artistRefId: s.artistRef?.id ?? null,
        albumRefId: s.albumRef?.id ?? null,
        imageUrl: manualCover,
      },
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manualCover,
      },
      points: e.points,
      voters: 1,
      status,
      delta: e.delta,
      prevPos: e.prevPos,
      peak: e.peak,
      weeks: e.weeks,
    };
  });
}

async function computeOfficialCommunityChartData(
  communityId: string,
  config: CommunityPointsConfig,
  requestedWeekIndex?: number,
): Promise<CommunityChartPayload> {
  const weekChart = await resolveOfficialCommunityWeekChart(communityId, requestedWeekIndex);
  if (!weekChart) {
    const fallback = await weekMetaFromIndex(requestedWeekIndex ?? getRankingWeekReference().weekIndex);
    return {
      weekIndex: requestedWeekIndex ?? getRankingWeekReference().weekIndex,
      weekLabel: fallback.weekLabel,
      dateRange: fallback.dateRange,
      contributorCount: 0,
      overallChartCount: 0,
      weeklySongs: [],
      weeklyArtists: [],
      overallSongs: [],
      overallArtists: [],
      weeklyDropouts: [],
    };
  }

  const weekIndex = weekChart.weekIndex;
  const prevWeek = prevChartWeekIndex(weekIndex);
  const limit = config.maxSongs;

  const [weeklyRaw, prevWeeklyRaw, overallRaw, overallChartCount] = await Promise.all([
    loadOfficialCommunityChartEntries(communityId, weekIndex),
    loadOfficialCommunityChartEntries(communityId, prevWeek),
    loadOfficialCommunityChartEntries(communityId),
    prisma.chart.count({ where: { communityId, isPublished: true } }),
  ]);

  const weeklyEntries = applyCommunityPointRules(weeklyRaw, config);
  const prevWeeklyEntries = applyCommunityPointRules(prevWeeklyRaw, config);
  const overallEntries = applyCommunityPointRules(overallRaw, config);

  const weeklySongs = mapOfficialEntriesToGlobalSongs(weeklyEntries as OfficialChartEntryRow[]);
  const weeklyArtists = aggregateTopArtists(weeklyEntries, limit, {
    previousWeekEntries: prevWeeklyEntries,
    weightMode: "stored",
  });
  const overallSongs = aggregateGlobalSongs(overallEntries, COMMUNITY_OVERALL_RANKING_LIMIT, {
    weightMode: "stored",
  });
  const overallArtists = aggregateTopArtists(overallEntries, COMMUNITY_OVERALL_RANKING_LIMIT, {
    weightMode: "stored",
  });

  function songKey(song: { spotifyId?: string | null; title: string; artist: string }): string {
    if (song.spotifyId) return `spotify:${song.spotifyId}`;
    return `local:${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`;
  }
  const currentKeySet = new Set(weeklySongs.map((s) => songKey(s.song)));
  const prevWeeklySongs = mapOfficialEntriesToGlobalSongs(
    prevWeeklyEntries as OfficialChartEntryRow[],
  );
  const weeklyDropoutsRaw = prevWeeklySongs.filter((s) => !currentKeySet.has(songKey(s.song)));

  const [hydratedWeekly, hydratedOverall, hydratedDropouts] = await Promise.all([
    hydrateSongCovers(weeklySongs),
    hydrateSongCovers(overallSongs),
    hydrateSongCovers(weeklyDropoutsRaw),
  ]);

  return {
    weekIndex,
    weekLabel: weekChart.weekLabel,
    dateRange: weekChart.dateRange,
    contributorCount: weeklyRaw.length > 0 ? 1 : 0,
    overallChartCount,
    weeklySongs: hydratedWeekly,
    weeklyArtists,
    overallSongs: hydratedOverall,
    overallArtists,
    weeklyDropouts: hydratedDropouts,
  };
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
  /** Parada oficial da comunidade (histórico importado), em vez de agregação de membros. */
  usesOfficialParada?: boolean;
  weeklySongs: GlobalSnapshotPayload["weeklySongs"];
  weeklyArtists: GlobalSnapshotPayload["weeklyArtists"];
  overallSongs: GlobalSnapshotPayload["overallSongs"];
  overallArtists: GlobalSnapshotPayload["overallArtists"];
  weeklyDropouts: GlobalSnapshotPayload["weeklySongs"];
};

export async function computeCommunityChartData(
  communityId: string,
  config: CommunityPointsConfig,
  options: ComputeCommunityChartOptions = {},
): Promise<CommunityChartPayload> {
  const { weekIndex: requestedWeekIndex, referenceDate = new Date() } = options;

  if (await communityHasOfficialCharts(communityId)) {
    const official = await computeOfficialCommunityChartData(
      communityId,
      config,
      requestedWeekIndex,
    );
    return { ...official, usesOfficialParada: true };
  }

  const rankingWeek = getRankingWeekReference(referenceDate);
  const weekIndex = requestedWeekIndex ?? rankingWeek.weekIndex;
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
  const overallSongs = aggregateGlobalSongs(overallEntries, COMMUNITY_OVERALL_RANKING_LIMIT, {
    weightMode: "stored",
  });
  const overallArtists = aggregateTopArtists(overallEntries, COMMUNITY_OVERALL_RANKING_LIMIT, {
    weightMode: "stored",
  });

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

  const weekMeta =
    (await prisma.chart.findFirst({
      where: {
        userId: { in: userIds },
        weekIndex,
        ...publishedPrimaryParadaChartWhere,
      },
      select: { weekLabel: true, dateRange: true },
    })) ?? (await weekMetaFromIndex(weekIndex));

  return {
    weekIndex,
    weekLabel: weekMeta.weekLabel,
    dateRange: weekMeta.dateRange,
    contributorCount,
    overallChartCount,
    weeklySongs: hydratedWeekly,
    weeklyArtists,
    overallSongs: hydratedOverall,
    overallArtists,
    weeklyDropouts: hydratedDropouts,
  };
}
