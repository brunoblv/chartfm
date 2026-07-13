import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { listGlobalLastfmWeekIndexes, loadGlobalLastfmSnapshot } from "@/lib/global-lastfm-snapshot";
import type { GlobalLastfmMode } from "@/lib/global-lastfm-ranking";

type SearchParams = Promise<{ week?: string }> | { week?: string };

export async function loadGlobalLastfmPageData(mode: GlobalLastfmMode, searchParams?: SearchParams) {
  const params = searchParams ? ("then" in searchParams ? await searchParams : searchParams) : {};
  const requestedWeekRaw = params.week ?? "";
  const requestedWeek = Number(requestedWeekRaw);
  const rankingWeek = getRankingWeekReference(new Date(), await getGlobalPublishSlot());

  let availableWeekIndexes: number[] = [];
  try {
    availableWeekIndexes = await listGlobalLastfmWeekIndexes(mode);
  } catch {
    availableWeekIndexes = [];
  }

  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? rankingWeek.weekIndex;

  const canonicalWeekParam = String(weekIndex);
  const needsWeekRedirect = requestedWeekRaw !== canonicalWeekParam;

  const snapshot = await loadGlobalLastfmSnapshot(mode, weekIndex).catch(() => null);

  const currentIndexInList = availableWeekIndexes.indexOf(weekIndex);
  const newerWeek = currentIndexInList > 0 ? availableWeekIndexes[currentIndexInList - 1] : null;
  const olderWeek =
    currentIndexInList >= 0 && currentIndexInList < availableWeekIndexes.length - 1
      ? availableWeekIndexes[currentIndexInList + 1]
      : null;

  return {
    weekIndex,
    weekLabel: snapshot?.weekLabel ?? rankingWeek.weekLabel,
    dateRange: snapshot?.dateRange ?? rankingWeek.dateRange,
    scoringWindow: snapshot?.scoringWindow ?? "",
    entries: snapshot?.payload.entries ?? [],
    contributorCount: snapshot?.payload.contributorCount ?? 0,
    youtubePlaylistId: snapshot?.youtubePlaylistId ?? null,
    hasSnapshot: Boolean(snapshot),
    olderWeek,
    newerWeek,
    needsWeekRedirect,
  };
}
