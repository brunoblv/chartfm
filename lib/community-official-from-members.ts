/**
 * Persiste a parada oficial semanal de uma comunidade a partir das paradas
 * primárias publicadas dos membros (mesma agregação do modo "ao vivo").
 *
 * Usado quando a comunidade já tem histórico oficial (ex.: UCC importada) e
 * precisa continuar gerando semanas novas — o modo oficial não agrega sozinho.
 */

import { prisma } from "@/lib/prisma";
import {
  buildDateRangeFromDate,
  buildWeekLabelFromDate,
  getChartWeekRange,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
  nextChartWeekIndex,
  prevChartWeekIndex,
} from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { recomputePersistedChartEntryStatsForParada } from "@/lib/chart-entry-stats";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import {
  parseCommunityPointsConfig,
  type CommunityPointsConfig,
} from "@/lib/community-chart";
import {
  aggregateGlobalSongs,
  type WeeklyChartEntryRow,
} from "@/lib/weekly-chart-aggregate";

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
  weekIndex: number,
): Promise<WeeklyChartEntryRow[]> {
  if (!memberIds.length) return [];
  return prisma.chartEntry.findMany({
    where: {
      chart: {
        userId: { in: memberIds },
        weekIndex,
        ...publishedPrimaryParadaChartWhere,
      },
      position: { lte: 100 },
    },
    select: entrySelect,
  });
}

async function ensureCommunityOfficialParada(communityId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      slug: true,
      name: true,
      paradaName: true,
      ownerId: true,
      maxSongs: true,
      memberPositionLimit: true,
      pointsMode: true,
      customPoints: true,
    },
  });
  if (!community) throw new Error(`Comunidade ${communityId} não encontrada.`);
  if (!community.ownerId) {
    throw new Error(`Comunidade ${community.slug} sem owner — não dá para anexar parada oficial.`);
  }

  let parada = await prisma.parada.findFirst({
    where: {
      userId: community.ownerId,
      name: { equals: community.paradaName, mode: "insensitive" },
    },
  });

  if (!parada) {
    const sortOrder = await prisma.parada.count({ where: { userId: community.ownerId } });
    parada = await prisma.parada.create({
      data: {
        userId: community.ownerId,
        name: community.paradaName,
        isPrimary: false,
        isCommunityOfficial: true,
        sortOrder,
        chartSize: community.maxSongs ?? 20,
        cadence: "WEEKLY",
        genres: ["Pop"],
      },
    });
  } else if (!parada.isCommunityOfficial) {
    parada = await prisma.parada.update({
      where: { id: parada.id },
      data: { isCommunityOfficial: true },
    });
  }

  return { community, parada, config: parseCommunityPointsConfig(community) };
}

export type PublishCommunityOfficialWeekResult = {
  communityId: string;
  slug?: string;
  weekIndex: number;
  status: "created" | "updated" | "skipped" | "empty";
  entryCount: number;
  contributorCount: number;
};

export type PublishCommunityOfficialWeekOptions = {
  force?: boolean;
  dryRun?: boolean;
  /** Se false, não recalcula peak/weeks/status (útil no backfill em lote). Default true. */
  recomputeStats?: boolean;
};

/**
 * Agrega as paradas primárias dos membros na semana e persiste como Chart oficial
 * da comunidade (`communityId` preenchido).
 */
export async function publishCommunityOfficialWeekFromMembers(
  communityId: string,
  weekIndex: number,
  options: PublishCommunityOfficialWeekOptions = {},
): Promise<PublishCommunityOfficialWeekResult> {
  const { force = false, dryRun = false, recomputeStats = true } = options;
  const { community, parada, config } = await ensureCommunityOfficialParada(communityId);

  const existing = await prisma.chart.findUnique({
    where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
    select: { id: true, communityId: true, _count: { select: { entries: true } } },
  });

  if (existing && !force) {
    return {
      communityId,
      slug: community.slug,
      weekIndex,
      status: "skipped",
      entryCount: existing._count.entries,
      contributorCount: 0,
    };
  }

  const members = await prisma.communityMember.findMany({
    where: { communityId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  const raw = await loadMemberChartEntries(userIds, weekIndex);
  const weeklyEntries = applyCommunityPointRules(raw, config);
  const contributorCount = new Set(raw.map((e) => e.chartId)).size;

  if (!weeklyEntries.length) {
    return {
      communityId,
      slug: community.slug,
      weekIndex,
      status: "empty",
      entryCount: 0,
      contributorCount: 0,
    };
  }

  const prevWeek = prevChartWeekIndex(weekIndex);
  const prevRaw = await loadMemberChartEntries(userIds, prevWeek);
  const prevWeeklyEntries = applyCommunityPointRules(prevRaw, config);

  const limit = config.maxSongs;
  const ranked = aggregateGlobalSongs(weeklyEntries, limit, {
    previousWeekEntries: prevWeeklyEntries,
    weightMode: "stored",
  });

  const slot = await getGlobalPublishSlot();
  const ref = getWeeklySnapshotReferenceDate(weekIndex, slot);
  const weekLabel = buildWeekLabelFromDate(ref);
  const dateRange = buildDateRangeFromDate(ref);
  const { start: weekStart } = getChartWeekRange(ref);

  const entryPayload = ranked.map((row) => ({
    position: row.position,
    songId: row.song.id,
    songSpotifyId: row.song.spotifyId,
    albumSpotifyId: null as string | null,
    points: Math.max(0, Math.round(row.points)),
    status: row.status,
    delta: row.delta,
    prevPos: row.prevPos,
    peak: row.peak,
    weeks: row.weeks,
    coverPaletteA: row.cover.palette[0],
    coverPaletteB: row.cover.palette[1],
    coverSeed: row.cover.seed,
  }));

  // Preenche albumSpotifyId a partir do Song quando existir
  const songIds = entryPayload.map((e) => e.songId);
  const songs = await prisma.song.findMany({
    where: { id: { in: songIds } },
    select: { id: true, albumSpotifyId: true },
  });
  const albumBySong = new Map(songs.map((s) => [s.id, s.albumSpotifyId]));
  for (const e of entryPayload) {
    e.albumSpotifyId = albumBySong.get(e.songId) ?? null;
  }

  if (dryRun) {
    return {
      communityId,
      slug: community.slug,
      weekIndex,
      status: existing ? "updated" : "created",
      entryCount: entryPayload.length,
      contributorCount,
    };
  }

  const chartPayload = {
    weekLabel,
    dateRange,
    publishedAt: ref,
    weekStartDate: weekStart,
    maxItems: entryPayload.length,
    communityId: community.id,
    isPublished: true,
    entries: { create: entryPayload },
  };

  if (!existing) {
    await prisma.chart.create({
      data: {
        userId: community.ownerId!,
        paradaId: parada.id,
        weekIndex,
        ...chartPayload,
      },
    });
  } else {
    await prisma.$transaction([
      prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
      prisma.chart.update({
        where: { id: existing.id },
        data: {
          weekLabel,
          dateRange,
          publishedAt: ref,
          weekStartDate: weekStart,
          maxItems: entryPayload.length,
          communityId: community.id,
          isPublished: true,
          entries: { create: entryPayload },
        },
      }),
    ]);
  }

  if (recomputeStats) {
    await recomputePersistedChartEntryStatsForParada(prisma, parada.id, weekIndex);
  }

  return {
    communityId,
    slug: community.slug,
    weekIndex,
    status: existing ? "updated" : "created",
    entryCount: entryPayload.length,
    contributorCount,
  };
}

/**
 * Comunidades que já operam em modo parada oficial (têm ao menos um Chart com communityId).
 */
export async function listCommunitiesWithOfficialCharts(): Promise<
  Array<{ id: string; slug: string; name: string }>
> {
  const rows = await prisma.chart.findMany({
    where: { communityId: { not: null }, isPublished: true },
    select: { communityId: true },
    distinct: ["communityId"],
  });
  const ids = rows.map((r) => r.communityId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  return prisma.community.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });
}

/**
 * Congela a semana de ranking atual para todas as comunidades com parada oficial.
 * Create-only (não sobrescreve), alinhado ao publish-weekly-globals.
 */
export async function publishAllCommunityOfficialWeeksFromMembers(
  now: Date = new Date(),
  options: { force?: boolean } = {},
) {
  const slot = await getGlobalPublishSlot();
  const { weekIndex } = getRankingWeekReference(now, slot);
  const communities = await listCommunitiesWithOfficialCharts();

  const results: PublishCommunityOfficialWeekResult[] = [];
  for (const community of communities) {
    try {
      const result = await publishCommunityOfficialWeekFromMembers(community.id, weekIndex, {
        force: options.force,
        recomputeStats: true,
      });
      results.push({ ...result, slug: community.slug });
    } catch (e) {
      console.error(
        `[community-official-from-members] ${community.slug} week ${weekIndex}`,
        e,
      );
      results.push({
        communityId: community.id,
        slug: community.slug,
        weekIndex,
        status: "empty",
        entryCount: 0,
        contributorCount: 0,
      });
    }
  }

  return {
    weekIndex,
    communities: communities.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    empty: results.filter((r) => r.status === "empty").length,
    results,
  };
}

/** Lista weekIndexes inclusivos entre from e until. */
export function listWeekIndexesInclusive(fromWeekIndex: number, untilWeekIndex: number): number[] {
  if (fromWeekIndex > untilWeekIndex) return [];
  const out: number[] = [];
  let cur = fromWeekIndex;
  // teto de segurança (~5 anos)
  for (let i = 0; i < 300 && cur <= untilWeekIndex; i++) {
    out.push(cur);
    cur = nextChartWeekIndex(cur);
  }
  return out;
}
