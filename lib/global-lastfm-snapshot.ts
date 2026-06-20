import { prisma } from "@/lib/prisma";
import {
  buildDateRangeFromDate,
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
  prevChartWeekIndex,
} from "@/lib/chart-week";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";
import { listGlobalRankingWeekIndexes } from "@/lib/global-snapshot";
import {
  computeGlobalLastfmRanking,
  type GlobalLastfmEntry,
  type GlobalLastfmMode,
} from "@/lib/global-lastfm-ranking";

export type GlobalLastfmSnapshotPayload = {
  entries: GlobalLastfmEntry[];
  contributorCount: number;
  scoringWindow: string;
};

function asPayload(row: {
  entries: unknown;
  contributorCount: number;
  scoringWindow: string;
}): GlobalLastfmSnapshotPayload {
  return {
    entries: row.entries as GlobalLastfmEntry[],
    contributorCount: row.contributorCount,
    scoringWindow: row.scoringWindow,
  };
}

async function loadPrevEntries(mode: GlobalLastfmMode, weekIndex: number): Promise<GlobalLastfmEntry[]> {
  const prevWeek = prevChartWeekIndex(weekIndex);
  if (mode === "airplay") {
    const row = await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex: prevWeek } });
    return row ? (row.entries as GlobalLastfmEntry[]) : [];
  }
  const row = await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex: prevWeek } });
  return row ? (row.entries as GlobalLastfmEntry[]) : [];
}

async function computeSnapshot(mode: GlobalLastfmMode, referenceDate: Date, weekIndex?: number) {
  const meta = weekIndex != null ? weekMetaFromWeekIndex(weekIndex) : resolveGlobalLastfmWeekMeta(referenceDate);
  const prevEntries = await loadPrevEntries(mode, meta.weekIndex);
  const computed = await computeGlobalLastfmRanking(mode, referenceDate, prevEntries);
  return { ...meta, ...computed };
}

function weekMetaFromWeekIndex(weekIndex: number) {
  const referenceDate = getWeeklySnapshotReferenceDate(weekIndex);
  return {
    weekIndex,
    weekLabel: buildWeekLabelFromDate(referenceDate),
    dateRange: buildDateRangeFromDate(referenceDate),
  };
}

export function resolveGlobalLastfmWeekMeta(referenceDate: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(referenceDate);
  return {
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
  };
}

export async function saveGlobalLastfmSnapshotForWeek(mode: GlobalLastfmMode, weekIndex: number) {
  const referenceDate = getWeeklySnapshotReferenceDate(weekIndex);
  const computed = await computeSnapshot(mode, referenceDate, weekIndex);
  const data = {
    weekLabel: computed.weekLabel,
    dateRange: computed.dateRange,
    scoringWindow: computed.scoringWindow,
    entries: computed.entries as unknown as object,
    contributorCount: computed.contributorCount,
    frozenAt: new Date(),
  };

  if (mode === "airplay") {
    const saved = await prisma.globalAirplaySnapshot.upsert({
      where: { weekIndex },
      update: data,
      create: { weekIndex, ...data },
    });
    return { weekIndex, payload: asPayload(saved), created: false };
  }

  const saved = await prisma.globalAlbumsSnapshot.upsert({
    where: { weekIndex },
    update: data,
    create: { weekIndex, ...data },
  });
  return { weekIndex, payload: asPayload(saved), created: false };
}

export async function rebuildAllGlobalLastfmSnapshots(
  mode: GlobalLastfmMode,
  options?: { onWeek?: (weekIndex: number, index: number, total: number) => void },
) {
  const deleted =
    mode === "airplay"
      ? await prisma.globalAirplaySnapshot.deleteMany()
      : await prisma.globalAlbumsSnapshot.deleteMany();

  const weekIndexes = (await listGlobalRankingWeekIndexes())
    .filter((w) => w >= GLOBAL_RANKING_FIRST_WEEK_INDEX)
    .sort((a, b) => a - b);
  const total = weekIndexes.length;

  for (let i = 0; i < weekIndexes.length; i++) {
    const weekIndex = weekIndexes[i];
    options?.onWeek?.(weekIndex, i + 1, total);
    await saveGlobalLastfmSnapshotForWeek(mode, weekIndex);
  }

  return { deletedCount: deleted.count, rebuiltWeeks: weekIndexes };
}

export async function rebuildAllGlobalLastfmSnapshotsBoth(options?: {
  onWeek?: (mode: GlobalLastfmMode, weekIndex: number, index: number, total: number) => void;
}) {
  const airplay = await rebuildAllGlobalLastfmSnapshots("airplay", {
    onWeek: (weekIndex, index, total) => options?.onWeek?.("airplay", weekIndex, index, total),
  });
  const albums = await rebuildAllGlobalLastfmSnapshots("albums", {
    onWeek: (weekIndex, index, total) => options?.onWeek?.("albums", weekIndex, index, total),
  });
  return { airplay, albums };
}

export async function getOrCreateGlobalLastfmSnapshot(
  mode: GlobalLastfmMode,
  referenceDate: Date = new Date(),
) {
  const meta = await resolveGlobalLastfmWeekMeta(referenceDate);

  if (mode === "airplay") {
    const existing = await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex: meta.weekIndex } });
    if (existing) {
      return {
        ...meta,
        scoringWindow: existing.scoringWindow,
        payload: asPayload(existing),
        created: false,
      };
    }

    const computed = await computeSnapshot(mode, referenceDate);
    const created = await prisma.globalAirplaySnapshot.create({
      data: {
        weekIndex: computed.weekIndex,
        weekLabel: computed.weekLabel,
        dateRange: computed.dateRange,
        scoringWindow: computed.scoringWindow,
        entries: computed.entries as unknown as object,
        contributorCount: computed.contributorCount,
      },
    });
    return {
      weekIndex: created.weekIndex,
      weekLabel: created.weekLabel,
      dateRange: created.dateRange,
      scoringWindow: created.scoringWindow,
      payload: asPayload(created),
      created: true,
    };
  }

  const existing = await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex: meta.weekIndex } });
  if (existing) {
    return {
      ...meta,
      scoringWindow: existing.scoringWindow,
      payload: asPayload(existing),
      created: false,
    };
  }

  const computed = await computeSnapshot(mode, referenceDate);
  const created = await prisma.globalAlbumsSnapshot.create({
    data: {
      weekIndex: computed.weekIndex,
      weekLabel: computed.weekLabel,
      dateRange: computed.dateRange,
      scoringWindow: computed.scoringWindow,
      entries: computed.entries as unknown as object,
      contributorCount: computed.contributorCount,
    },
  });
  return {
    weekIndex: created.weekIndex,
    weekLabel: created.weekLabel,
    dateRange: created.dateRange,
    scoringWindow: created.scoringWindow,
    payload: asPayload(created),
    created: true,
  };
}

export async function refreshGlobalLastfmSnapshot(mode: GlobalLastfmMode, referenceDate: Date = new Date()) {
  const meta = await resolveGlobalLastfmWeekMeta(referenceDate);
  const existing =
    mode === "airplay"
      ? await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex: meta.weekIndex } })
      : await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex: meta.weekIndex } });

  const computed = await computeSnapshot(mode, referenceDate);
  const data = {
    weekLabel: computed.weekLabel,
    dateRange: computed.dateRange,
    scoringWindow: computed.scoringWindow,
    entries: computed.entries as unknown as object,
    contributorCount: computed.contributorCount,
    frozenAt: new Date(),
  };

  if (mode === "airplay") {
    const saved = await prisma.globalAirplaySnapshot.upsert({
      where: { weekIndex: computed.weekIndex },
      update: data,
      create: { weekIndex: computed.weekIndex, ...data },
    });
    return { ...saved, created: !existing };
  }

  const saved = await prisma.globalAlbumsSnapshot.upsert({
    where: { weekIndex: computed.weekIndex },
    update: data,
    create: { weekIndex: computed.weekIndex, ...data },
  });
  return { ...saved, created: !existing };
}

export async function refreshAllGlobalLastfmSnapshots(referenceDate: Date = new Date()) {
  const [airplay, albums] = await Promise.all([
    refreshGlobalLastfmSnapshot("airplay", referenceDate),
    refreshGlobalLastfmSnapshot("albums", referenceDate),
  ]);
  return { airplay, albums };
}

export async function listGlobalLastfmWeekIndexes(mode: GlobalLastfmMode): Promise<number[]> {
  const rankingWeek = getRankingWeekReference(new Date());
  if (mode === "airplay") {
    const rows = await prisma.globalAirplaySnapshot.findMany({
      where: { weekIndex: { lte: rankingWeek.weekIndex } },
      select: { weekIndex: true },
      orderBy: { weekIndex: "desc" },
    });
    return rows.map((r) => r.weekIndex);
  }
  const rows = await prisma.globalAlbumsSnapshot.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true },
    orderBy: { weekIndex: "desc" },
  });
  return rows.map((r) => r.weekIndex);
}

export async function loadGlobalLastfmSnapshot(mode: GlobalLastfmMode, weekIndex: number) {
  if (mode === "airplay") {
    const row = await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex } });
    if (!row) return null;
    return {
      weekIndex: row.weekIndex,
      weekLabel: row.weekLabel,
      dateRange: row.dateRange,
      scoringWindow: row.scoringWindow,
      youtubePlaylistId: row.youtubePlaylistId ?? null,
      payload: asPayload(row),
    };
  }
  const row = await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex } });
  if (!row) return null;
  return {
    weekIndex: row.weekIndex,
    weekLabel: row.weekLabel,
    dateRange: row.dateRange,
    scoringWindow: row.scoringWindow,
    youtubePlaylistId: null,
    payload: asPayload(row),
  };
}
