/**
 * Preview da parada Disk MTV SEM filtro de clipe — para pré-preenchimento
 * de MVs no admin antes do freeze oficial.
 */

import { prisma } from "@/lib/prisma";
import {
  applyCommunityPointRules,
  parseCommunityPointsConfig,
} from "@/lib/community-chart";
import {
  DISK_MTV_COMMUNITY_SLUG,
  songHasOfficialMusicVideo,
} from "@/lib/community-song-rules";
import {
  buildDateRangeFromDate,
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
  prevChartWeekIndex,
} from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import {
  aggregateGlobalSongs,
  artistDisplayName,
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

export type DiskMtvClipPreviewRow = {
  position: number;
  points: number;
  status: string;
  delta: number | null;
  prevPos: number | null;
  voters: number;
  songId: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  hasClip: boolean;
  musicVideoReleaseDate: string | null;
  youtubeReleaseDate: string | null;
  youtubeId: string | null;
  clipPublishedAt: string | null;
  sourcesNotFound: string[];
  /** Posição entre as elegíveis (só com clipe) — null se sem clipe. */
  eligiblePosition: number | null;
  /** Entraria no top oficial (maxSongs) se o freeze rodasse agora. */
  inOfficialTop: boolean;
};

export type DiskMtvClipPreview = {
  slug: string;
  name: string;
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  maxSongs: number;
  contributorCount: number;
  memberCount: number;
  entryCount: number;
  withClip: number;
  withoutClip: number;
  officialEligibleCount: number;
  rows: DiskMtvClipPreviewRow[];
};

function ymd(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function getDiskMtvClipPreview(options?: {
  weekIndex?: number;
  limit?: number;
}): Promise<DiskMtvClipPreview> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 20), 500);

  const community = await prisma.community.findUnique({
    where: { slug: DISK_MTV_COMMUNITY_SLUG },
    select: {
      id: true,
      slug: true,
      name: true,
      maxSongs: true,
      memberPositionLimit: true,
      pointsMode: true,
      customPoints: true,
    },
  });
  if (!community) {
    throw new Error(`Comunidade ${DISK_MTV_COMMUNITY_SLUG} não encontrada.`);
  }

  const config = parseCommunityPointsConfig(community);
  const slot = await getGlobalPublishSlot();
  const ranking = getRankingWeekReference(new Date(), slot);
  const weekIndex = options?.weekIndex ?? ranking.weekIndex;
  const prevWeek = prevChartWeekIndex(weekIndex);
  const ref = getWeeklySnapshotReferenceDate(weekIndex, slot);

  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);

  const [raw, prevRaw] = await Promise.all([
    prisma.chartEntry.findMany({
      where: {
        chart: { userId: { in: userIds }, weekIndex, ...publishedPrimaryParadaChartWhere },
        position: { lte: 100 },
      },
      select: entrySelect,
    }),
    prisma.chartEntry.findMany({
      where: {
        chart: {
          userId: { in: userIds },
          weekIndex: prevWeek,
          ...publishedPrimaryParadaChartWhere,
        },
        position: { lte: 100 },
      },
      select: entrySelect,
    }),
  ]);

  const weeklyEntries = applyCommunityPointRules(raw as WeeklyChartEntryRow[], config);
  const prevWeeklyEntries = applyCommunityPointRules(prevRaw as WeeklyChartEntryRow[], config);
  const contributorCount = new Set(raw.map((e) => e.chartId)).size;

  const ranked = aggregateGlobalSongs(weeklyEntries, limit, {
    previousWeekEntries: prevWeeklyEntries,
    weightMode: "stored",
  });

  const songIds = ranked.map((r) => r.song.id!).filter(Boolean);
  const songsMeta = await prisma.song.findMany({
    where: { id: { in: songIds } },
    select: {
      id: true,
      musicVideoReleaseDate: true,
      youtubeReleaseDate: true,
      sourcesNotFound: true,
      videoClips: {
        where: { clipType: "OFFICIAL", youtubeId: { not: null } },
        select: { youtubeId: true, publishedAt: true },
        orderBy: [{ votes: "desc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
  });
  const metaById = new Map(songsMeta.map((s) => [s.id, s]));

  let eligiblePos = 0;
  const rows: DiskMtvClipPreviewRow[] = ranked.map((r) => {
    const meta = metaById.get(r.song.id!);
    const youtubeId = meta?.videoClips[0]?.youtubeId ?? null;
    const hasClip = songHasOfficialMusicVideo({
      musicVideoReleaseDate: meta?.musicVideoReleaseDate ?? null,
      youtubeReleaseDate: meta?.youtubeReleaseDate ?? null,
      hasOfficialVideoClip: Boolean(youtubeId),
    });
    const thisEligible = hasClip ? ++eligiblePos : null;
    return {
      position: r.position,
      points: Math.round(r.points),
      status: r.status,
      delta: r.delta,
      prevPos: r.prevPos ?? null,
      voters: r.voters,
      songId: r.song.id!,
      title: r.song.title,
      artist: artistDisplayName(r.song as WeeklyChartEntryRow["song"]),
      spotifyId: r.song.spotifyId ?? null,
      hasClip,
      musicVideoReleaseDate: ymd(meta?.musicVideoReleaseDate),
      youtubeReleaseDate: ymd(meta?.youtubeReleaseDate),
      youtubeId,
      clipPublishedAt: ymd(meta?.videoClips[0]?.publishedAt ?? null),
      sourcesNotFound: meta?.sourcesNotFound ?? [],
      eligiblePosition: thisEligible,
      inOfficialTop: thisEligible != null && thisEligible <= config.maxSongs,
    };
  });

  const withClip = rows.filter((r) => r.hasClip).length;

  return {
    slug: community.slug,
    name: community.name,
    weekIndex,
    weekLabel: buildWeekLabelFromDate(ref),
    dateRange: buildDateRangeFromDate(ref),
    maxSongs: config.maxSongs,
    contributorCount,
    memberCount: userIds.length,
    entryCount: rows.length,
    withClip,
    withoutClip: rows.length - withClip,
    officialEligibleCount: eligiblePos,
    rows,
  };
}
