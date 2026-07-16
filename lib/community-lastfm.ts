import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  computeGlobalLastfmRanking,
  type GlobalLastfmEntry,
  type GlobalLastfmMode,
} from "@/lib/global-lastfm-ranking";
import { getCommunityMemberUserIds } from "@/lib/community-auth";

export type CommunityLastfmPayload = {
  weekLabel: string;
  dateRange: string;
  scoringWindow: string;
  contributorCount: number;
  entries: GlobalLastfmEntry[];
};

// Cache em memória por comunidade+modo: as páginas /community/[slug]/airplay|albums
// calculavam o ranking AO VIVO a cada visita (Last.fm de cada membro + /search do Spotify
// pra cada faixa fora do catálogo) — crawlers/bots nessas páginas geravam centenas de
// chamadas por hora e eram a maior fonte de 429 (descoberto via /admin/logs, 2026-07-16).
const rankingCache = new Map<string, { payload: CommunityLastfmPayload; expiresAt: number }>();
const RANKING_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const RANKING_CACHE_MAX = 100;

export async function computeCommunityLastfmRanking(
  communityId: string,
  mode: GlobalLastfmMode,
  chartLimit = 50,
  referenceDate: Date = new Date(),
): Promise<CommunityLastfmPayload> {
  const cacheKey = `${communityId}|${mode}|${chartLimit}`;
  const cached = rankingCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.payload;

  const rankingWeek = getRankingWeekReference(referenceDate, await getGlobalPublishSlot());
  const memberIds = await getCommunityMemberUserIds(communityId);

  const { entries, contributorCount, scoringWindow } = await computeGlobalLastfmRanking(
    mode,
    referenceDate,
    [],
    { userIds: memberIds, chartLimit },
  );

  const payload: CommunityLastfmPayload = {
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
    scoringWindow,
    contributorCount,
    entries,
  };

  if (rankingCache.size >= RANKING_CACHE_MAX) {
    const first = rankingCache.keys().next().value;
    if (first !== undefined) rankingCache.delete(first);
  }
  rankingCache.set(cacheKey, { payload, expiresAt: Date.now() + RANKING_CACHE_TTL_MS });
  return payload;
}
