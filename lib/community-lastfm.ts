import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  computeGlobalLastfmRanking,
  type GlobalLastfmEntry,
  type GlobalLastfmMode,
} from "@/lib/global-lastfm-ranking";
import { getCommunityMemberUserIds } from "@/lib/community-auth";
import { prisma } from "@/lib/prisma";

export type CommunityLastfmPayload = {
  weekLabel: string;
  dateRange: string;
  scoringWindow: string;
  contributorCount: number;
  entries: GlobalLastfmEntry[];
};

/**
 * Airplay/Álbuns de comunidade seguem o mesmo modelo do Global: snapshot semanal
 * congelado (CommunityLastfmSnapshot), criado uma única vez por semana — no
 * publish-weekly-globals (segunda, horário de /admin/parada-global) ou na primeira
 * visita da semana, o que vier primeiro. As páginas nunca recalculam em visita:
 * antes disso, cada acesso (inclusive crawlers) refazia Last.fm de cada membro +
 * buscas no Spotify, a maior fonte de 429 do app (descoberto 2026-07-16).
 */
async function computeCommunityLastfmRanking(
  communityId: string,
  mode: GlobalLastfmMode,
  chartLimit: number,
  referenceDate: Date,
): Promise<CommunityLastfmPayload> {
  const rankingWeek = getRankingWeekReference(referenceDate, await getGlobalPublishSlot());
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

function asPayload(row: {
  weekLabel: string;
  dateRange: string;
  scoringWindow: string;
  contributorCount: number;
  entries: unknown;
}): CommunityLastfmPayload {
  return {
    weekLabel: row.weekLabel,
    dateRange: row.dateRange,
    scoringWindow: row.scoringWindow,
    contributorCount: row.contributorCount,
    entries: row.entries as GlobalLastfmEntry[],
  };
}

/** Snapshot congelado da semana corrente — cria só se ainda não existir (create-only). */
export async function getOrCreateCommunityLastfmSnapshot(
  communityId: string,
  mode: GlobalLastfmMode,
  chartLimit = 50,
  referenceDate: Date = new Date(),
): Promise<CommunityLastfmPayload & { created: boolean }> {
  const rankingWeek = getRankingWeekReference(referenceDate, await getGlobalPublishSlot());

  const existing = await prisma.communityLastfmSnapshot.findUnique({
    where: {
      communityId_mode_weekIndex: { communityId, mode, weekIndex: rankingWeek.weekIndex },
    },
  });
  if (existing) return { ...asPayload(existing), created: false };

  const computed = await computeCommunityLastfmRanking(communityId, mode, chartLimit, referenceDate);

  // create com fallback pra corrida (duas visitas simultâneas na primeira vez da semana)
  try {
    const created = await prisma.communityLastfmSnapshot.create({
      data: {
        communityId,
        mode,
        weekIndex: rankingWeek.weekIndex,
        weekLabel: computed.weekLabel,
        dateRange: computed.dateRange,
        scoringWindow: computed.scoringWindow,
        contributorCount: computed.contributorCount,
        entries: computed.entries as unknown as object,
      },
    });
    return { ...asPayload(created), created: true };
  } catch {
    const raced = await prisma.communityLastfmSnapshot.findUnique({
      where: {
        communityId_mode_weekIndex: { communityId, mode, weekIndex: rankingWeek.weekIndex },
      },
    });
    if (raced) return { ...asPayload(raced), created: false };
    throw new Error("Falha ao salvar snapshot Last.fm da comunidade.");
  }
}

/**
 * Congela os snapshots da semana de todas as comunidades — chamado pelo
 * publish-weekly-globals logo após os snapshots do Global.
 */
export async function publishAllCommunityLastfmSnapshots(referenceDate: Date = new Date()) {
  const communities = await prisma.community.findMany({
    select: { id: true, slug: true, maxSongs: true },
  });

  let created = 0;
  const errors: string[] = [];
  for (const c of communities) {
    for (const mode of ["airplay", "albums"] as const) {
      try {
        const result = await getOrCreateCommunityLastfmSnapshot(c.id, mode, c.maxSongs, referenceDate);
        if (result.created) created += 1;
      } catch (err) {
        errors.push(`${c.slug}/${mode}: ${String(err)}`);
      }
    }
  }

  return { communities: communities.length, created, errors };
}
