import { getRankingWeekReference } from "@/lib/chart-week";
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

export async function computeCommunityLastfmRanking(
  communityId: string,
  mode: GlobalLastfmMode,
  chartLimit = 50,
  referenceDate: Date = new Date(),
): Promise<CommunityLastfmPayload> {
  const rankingWeek = getRankingWeekReference(referenceDate);
  const memberIds = await getCommunityMemberUserIds(communityId);

  const { entries, contributorCount, scoringWindow } = await computeGlobalLastfmRanking(
    mode,
    referenceDate,
    [],
    { userIds: memberIds, chartLimit },
  );

  return {
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
    scoringWindow,
    contributorCount,
    entries,
  };
}
