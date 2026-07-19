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

/**
 * Ajusta pontos das entradas dos membros conforme config da comunidade.
 * No modo `custom`, remapeia pela tabela e **remove** posições fora dela
 * (points 0). Não deixar 0 chegar em `aggregateGlobalSongs`/`weightMode:"stored"`:
 * lá `points === 0` cai no fallback da escala primária (1000→10).
 */
export function applyCommunityPointRules(
  entries: WeeklyChartEntryRow[],
  config: CommunityPointsConfig,
): WeeklyChartEntryRow[] {
  let filtered = entries;
  if (config.memberPositionLimit != null) {
    filtered = entries.filter((e) => e.position <= config.memberPositionLimit!);
  }
  if (config.pointsMode === "custom" && config.customPoints?.length) {
    return filtered
      .map((e) => ({
        ...e,
        points: config.customPoints![e.position - 1] ?? 0,
      }))
      .filter((e) => e.points > 0);
  }
  return filtered;
}

async function communityHasOfficialWeek(
  communityId: string,
  weekIndex: number,
): Promise<boolean> {
  const chart = await prisma.chart.findFirst({
    where: { communityId, weekIndex, isPublished: true },
    select: { id: true },
  });
  return chart != null;
}

/**
 * Garante snapshot create-only da semana (igual Global 100 / Last.fm da comunidade).
 * Não sobrescreve semana já congelada — membro novo não reconta o passado.
 */
async function ensureCommunityOfficialWeekSnapshot(
  communityId: string,
  weekIndex: number,
): Promise<void> {
  if (await communityHasOfficialWeek(communityId, weekIndex)) return;
  const { publishCommunityOfficialWeekFromMembers } = await import(
    "@/lib/community-official-from-members"
  );
  await publishCommunityOfficialWeekFromMembers(communityId, weekIndex, {
    force: false,
    recomputeStats: true,
  });
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
  options: { referenceDate?: Date; ensureCurrentWeek?: boolean } = {},
): Promise<CommunityChartWeekMeta[]> {
  const { referenceDate = new Date(), ensureCurrentWeek = true } = options;

  if (ensureCurrentWeek) {
    const rankingWeek = getRankingWeekReference(referenceDate, await getGlobalPublishSlot());
    await ensureCommunityOfficialWeekSnapshot(communityId, rankingWeek.weekIndex);
  }

  return prisma.chart.findMany({
    where: { communityId, isPublished: true },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
  });
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
    const fallbackWeekIndex = requestedWeekIndex ?? getRankingWeekReference(new Date(), await getGlobalPublishSlot()).weekIndex;
    const fallback = await weekMetaFromIndex(fallbackWeekIndex);
    return {
      weekIndex: fallbackWeekIndex,
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

  const rankingWeek = getRankingWeekReference(referenceDate, await getGlobalPublishSlot());
  const weekIndex = requestedWeekIndex ?? rankingWeek.weekIndex;

  // Snapshot create-only: congela na 1ª vez; visitas / membros novos não recontam.
  await ensureCommunityOfficialWeekSnapshot(communityId, weekIndex);

  const official = await computeOfficialCommunityChartData(communityId, config, weekIndex);
  return { ...official, usesOfficialParada: true };
}
