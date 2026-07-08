import { prisma } from "@/lib/prisma";
import { getRankingWeekReference, getGlobalSnapshotDeadline } from "@/lib/chart-week";
import {
  GLOBAL_RANKING_FIRST_WEEK_INDEX,
  globalPrevWeekIndex,
  isGlobalRankingWeek,
} from "@/lib/global-ranking-config";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";

export type GlobalSnapshotPayload = {
  weeklySongs: ReturnType<typeof aggregateGlobalSongs>;
  weeklyArtists: ReturnType<typeof aggregateTopArtists>;
  overallSongs: ReturnType<typeof aggregateGlobalSongs>;
  overallArtists: ReturnType<typeof aggregateTopArtists>;
};

function asPayload(snapshot: {
  weeklySongs: unknown;
  weeklyArtists: unknown;
  overallSongs: unknown;
  overallArtists: unknown;
}): GlobalSnapshotPayload {
  return {
    weeklySongs: snapshot.weeklySongs as GlobalSnapshotPayload["weeklySongs"],
    weeklyArtists: snapshot.weeklyArtists as GlobalSnapshotPayload["weeklyArtists"],
    overallSongs: snapshot.overallSongs as GlobalSnapshotPayload["overallSongs"],
    overallArtists: snapshot.overallArtists as GlobalSnapshotPayload["overallArtists"],
  };
}

/** Filtro de chart com prazo de envio: só paradas publicadas antes da terça 00h BRT. */
function chartFilterWithDeadline(publishedBefore: Date) {
  return { parada: { isPrimary: true }, publishedAt: { lt: publishedBefore } };
}

async function loadWeeklyGlobalEntries(weekIdx: number, publishedBefore: Date): Promise<WeeklyChartEntryRow[]> {
  return prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx, ...chartFilterWithDeadline(publishedBefore) }, position: { lte: 100 } },
    select: {
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
    },
  });
}

// ---------------------------------------------------------------------------
// Chaves de agregação derivadas de snapshots congelados (GlobalChartEntry/TopArtistRow)
// Usam slugArtist (nome bruto do BD) para músicas sem Spotify ID, o que bate
// exatamente com songAggregationKey usada em aggregateGlobalSongs.
// ---------------------------------------------------------------------------

export function songSnapshotAggKey(song: {
  spotifyId?: string | null;
  title: string;
  artist: string;
  slugArtist?: string | null;
}): string {
  if (song.spotifyId) return `song_spotify:${song.spotifyId}`;
  const t = song.title.trim().replace(/\s+/g, " ").toLowerCase();
  const a = (song.slugArtist ?? song.artist).trim().replace(/\s+/g, " ").toLowerCase();
  return `song_local:${t}|${a}`;
}

function artistSnapshotAggKey(a: { spotifyId: string | null; name: string }): string {
  if (a.spotifyId) return `artist_spotify:${a.spotifyId}`;
  return `artist_name:${a.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

export type HistoricalStat = { peak: number; weeks: number; numberOnes: number };

function accumulateSongStats(
  songs: GlobalSnapshotPayload["weeklySongs"],
  stats: Map<string, HistoricalStat>,
): void {
  for (const s of songs) {
    const key = songSnapshotAggKey(s.song);
    const cur = stats.get(key) ?? { peak: s.position, weeks: 0, numberOnes: 0 };
    cur.peak = Math.min(cur.peak, s.position);
    cur.weeks += 1;
    if (s.position === 1) cur.numberOnes += 1;
    stats.set(key, cur);
  }
}

function accumulateArtistStats(
  artists: GlobalSnapshotPayload["weeklyArtists"],
  stats: Map<string, HistoricalStat>,
): void {
  for (const a of artists) {
    const key = artistSnapshotAggKey(a);
    const cur = stats.get(key) ?? { peak: a.position, weeks: 0, numberOnes: 0 };
    cur.peak = Math.min(cur.peak, a.position);
    cur.weeks += 1;
    if (a.position === 1) cur.numberOnes += 1;
    stats.set(key, cur);
  }
}

/**
 * Carrega todos os snapshots congelados para semanas < weekIdx e deriva:
 * - stats semanais (weeklySongs / weeklyArtists): posição no ranking semanal
 * - stats acumulados (overallSongs / overallArtists): posição no ranking geral
 *
 * Retorna mapas chave→{peak,weeks,numberOnes} para cada dimensão.
 * Ao contrário de loadHistoricalSongStats (baseado em entradas brutas com um único
 * deadline de corte), esta função respeita cada snapshot como foi congelado,
 * evitando que paradas publicadas retroativamente contaminem semanas anteriores.
 */
async function loadHistoricalStatsFromSnapshots(weekIdx: number): Promise<{
  weeklySongs: Map<string, HistoricalStat>;
  overallSongs: Map<string, HistoricalStat>;
  weeklyArtists: Map<string, HistoricalStat>;
  overallArtists: Map<string, HistoricalStat>;
}> {
  const snapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX, lt: weekIdx } },
    select: { weeklySongs: true, overallSongs: true, weeklyArtists: true, overallArtists: true },
    orderBy: { weekIndex: "asc" },
  });

  const weeklySongs = new Map<string, HistoricalStat>();
  const overallSongs = new Map<string, HistoricalStat>();
  const weeklyArtists = new Map<string, HistoricalStat>();
  const overallArtists = new Map<string, HistoricalStat>();

  for (const snap of snapshots) {
    accumulateSongStats(snap.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"], weeklySongs);
    accumulateSongStats(snap.overallSongs as unknown as GlobalSnapshotPayload["overallSongs"], overallSongs);
    accumulateArtistStats(snap.weeklyArtists as unknown as GlobalSnapshotPayload["weeklyArtists"], weeklyArtists);
    accumulateArtistStats(snap.overallArtists as unknown as GlobalSnapshotPayload["overallArtists"], overallArtists);
  }

  return { weeklySongs, overallSongs, weeklyArtists, overallArtists };
}

/**
 * Estatísticas de uma música no Global 100 oficial (paradas semanais congeladas):
 * em quantas semanas entrou no top 100, melhor posição e quantos #1.
 * Chaveado por {@link songSnapshotAggKey}. Músicas que nunca entraram ficam de fora do mapa.
 */
export async function loadSongGlobalStatsFromSnapshots(): Promise<Map<string, HistoricalStat>> {
  const snapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX } },
    select: { weeklySongs: true },
    orderBy: { weekIndex: "asc" },
  });
  const stats = new Map<string, HistoricalStat>();
  for (const snap of snapshots) {
    accumulateSongStats(
      snap.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"],
      stats,
    );
  }
  return stats;
}

/** Semanas, pico e #1s no Global 100 oficial (snapshots congelados). */
export function lookupSongGlobal100Stats(
  song: { spotifyId?: string | null; title: string; artist: string },
  stats: Map<string, HistoricalStat>,
): { weeks: number; peak: number; numberOnes: number } {
  const gs = stats.get(
    songSnapshotAggKey({
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      slugArtist: song.artist,
    }),
  );
  return {
    weeks: gs?.weeks ?? 0,
    peak: gs?.peak ?? 0,
    numberOnes: gs?.numberOnes ?? 0,
  };
}

/** Posição na última semana congelada do Global 100 (por faixa). */
export async function loadLatestGlobalWeeklySongPositions(): Promise<Map<string, number>> {
  const snap = await prisma.globalSnapshot.findFirst({
    where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX } },
    orderBy: { weekIndex: "desc" },
    select: { weeklySongs: true },
  });
  if (!snap) return new Map();
  const weekly = snap.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"];
  return new Map(weekly.map((s) => [songSnapshotAggKey(s.song), s.position]));
}

export function resolveSongGlobal100Stats(
  song: { spotifyId?: string | null; title: string; artist: string },
  historical: Map<string, HistoricalStat>,
  currentWeekPositions: Map<string, number>,
): { weeks: number; peak: number; number1s: number; currentWeekPos: number } {
  const base = lookupSongGlobal100Stats(song, historical);
  const key = songSnapshotAggKey({
    spotifyId: song.spotifyId,
    title: song.title,
    artist: song.artist,
    slugArtist: song.artist,
  });
  return {
    weeks: base.weeks,
    peak: base.peak,
    number1s: base.numberOnes,
    currentWeekPos: currentWeekPositions.get(key) ?? 9999,
  };
}

const chartEntrySelect = {
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

function buildSongPrevPositions(songs: GlobalSnapshotPayload["weeklySongs"]): Map<string, number> {
  return new Map(
    songs.map((s) => [songSnapshotAggKey(s.song), s.position] as [string, number]),
  );
}

function buildArtistPrevPositions(artists: GlobalSnapshotPayload["weeklyArtists"]): Map<string, number> {
  return new Map(
    artists.map((a) => [artistSnapshotAggKey(a), a.position] as [string, number]),
  );
}

export async function computeGlobalSnapshotData(
  weekIdx: number,
  options?: { skipDeadline?: boolean },
): Promise<GlobalSnapshotPayload> {
  if (!isGlobalRankingWeek(weekIdx)) {
    throw new Error(
      `Semana ${weekIdx} está antes do corte do Global 100 (${GLOBAL_RANKING_FIRST_WEEK_INDEX}).`,
    );
  }
  const prevWeekIdx = globalPrevWeekIndex(weekIdx);

  const FAR_FUTURE = new Date("2099-12-31T23:59:59Z");
  // Apenas paradas publicadas antes de terça 00h BRT entram no cálculo (a menos que skipDeadline)
  const deadline = options?.skipDeadline ? FAR_FUTURE : getGlobalSnapshotDeadline(weekIdx);
  const prevDeadline = prevWeekIdx
    ? (options?.skipDeadline ? FAR_FUTURE : getGlobalSnapshotDeadline(prevWeekIdx))
    : null;

  const [weeklyEntries, prevWeekEntries, historicalStats, prevFrozenSnapshot] =
    await Promise.all([
      loadWeeklyGlobalEntries(weekIdx, deadline),
      prevWeekIdx && prevDeadline ? loadWeeklyGlobalEntries(prevWeekIdx, prevDeadline) : Promise.resolve([]),
      loadHistoricalStatsFromSnapshots(weekIdx),
      prevWeekIdx ? prisma.globalSnapshot.findUnique({ where: { weekIndex: prevWeekIdx } }) : Promise.resolve(null),
    ]);

  const [overallEntries, prevOverallEntries] = await Promise.all([
    prisma.chartEntry.findMany({
      where: {
        chart: {
          weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX, lte: weekIdx },
          ...chartFilterWithDeadline(deadline),
        },
        position: { lte: 100 },
      },
      select: chartEntrySelect,
    }),
    prevWeekIdx && prevDeadline
      ? prisma.chartEntry.findMany({
          where: {
            chart: {
              weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX, lte: prevWeekIdx },
              ...chartFilterWithDeadline(prevDeadline),
            },
            position: { lte: 100 },
          },
          select: chartEntrySelect,
        })
      : Promise.resolve([]),
  ]);

  const prevPayload = prevFrozenSnapshot ? asPayload(prevFrozenSnapshot) : null;

  return {
    weeklySongs: aggregateGlobalSongs(weeklyEntries, 100, {
      previousWeekEntries: prevWeekEntries,
      historicalStatsBySongKey: historicalStats.weeklySongs,
      comparisonEntries: prevWeekEntries,
      prevPositionsByKey: prevPayload ? buildSongPrevPositions(prevPayload.weeklySongs) : undefined,
      weightMode: "stored",
    }),
    weeklyArtists: aggregateTopArtists(weeklyEntries, 100, {
      previousWeekEntries: prevWeekEntries,
      historicalStatsByArtistKey: historicalStats.weeklyArtists,
      comparisonEntries: prevWeekEntries,
      prevPositionsByKey: prevPayload ? buildArtistPrevPositions(prevPayload.weeklyArtists) : undefined,
      weightMode: "stored",
    }),
    overallSongs: aggregateGlobalSongs(overallEntries, 100, {
      previousWeekEntries: prevOverallEntries,
      historicalStatsBySongKey: historicalStats.overallSongs,
      comparisonEntries: prevOverallEntries,
      prevPositionsByKey: prevPayload ? buildSongPrevPositions(prevPayload.overallSongs) : undefined,
      weightMode: "stored",
    }),
    overallArtists: aggregateTopArtists(overallEntries, 100, {
      previousWeekEntries: prevOverallEntries,
      historicalStatsByArtistKey: historicalStats.overallArtists,
      comparisonEntries: prevOverallEntries,
      prevPositionsByKey: prevPayload ? buildArtistPrevPositions(prevPayload.overallArtists) : undefined,
      weightMode: "stored",
    }),
  };
}

/**
 * Top N artistas da última semana congelada do Global. O snapshot salvo guarda
 * só o top 100, então recalcula das entradas da semana (mesmo filtro/deadline)
 * para permitir limites maiores — usado pelo Radar de Lançamentos (top 200).
 */
export async function computeLatestWeeklyTopArtists(limit: number): Promise<{
  weekIndex: number;
  weekLabel: string;
  artists: ReturnType<typeof aggregateTopArtists>;
} | null> {
  const latest = await prisma.globalSnapshot.findFirst({
    orderBy: { weekIndex: "desc" },
    select: { weekIndex: true, weekLabel: true },
  });
  if (!latest) return null;

  const deadline = getGlobalSnapshotDeadline(latest.weekIndex);
  const entries = await loadWeeklyGlobalEntries(latest.weekIndex, deadline);
  return {
    weekIndex: latest.weekIndex,
    weekLabel: latest.weekLabel,
    artists: aggregateTopArtists(entries, limit, { weightMode: "stored" }),
  };
}

export async function getOrCreateRankingWeekSnapshot(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);
  const existing = await prisma.globalSnapshot.findUnique({
    where: { weekIndex: rankingWeek.weekIndex },
  });
  if (existing) {
    return {
      weekIndex: rankingWeek.weekIndex,
      weekLabel: rankingWeek.weekLabel,
      dateRange: rankingWeek.dateRange,
      payload: asPayload(existing),
      created: false,
    };
  }

  const payload = await computeGlobalSnapshotData(rankingWeek.weekIndex);
  const created = await prisma.globalSnapshot.create({
    data: {
      weekIndex: rankingWeek.weekIndex,
      weekLabel: rankingWeek.weekLabel,
      dateRange: rankingWeek.dateRange,
      weeklySongs: payload.weeklySongs as unknown as object,
      weeklyArtists: payload.weeklyArtists as unknown as object,
      overallSongs: payload.overallSongs as unknown as object,
      overallArtists: payload.overallArtists as unknown as object,
    },
  });
  return {
    weekIndex: rankingWeek.weekIndex,
    weekLabel: rankingWeek.weekLabel,
    dateRange: rankingWeek.dateRange,
    payload: asPayload(created),
    created: true,
  };
}

async function resolveWeekMeta(weekIndex: number): Promise<{ weekLabel: string; dateRange: string }> {
  const chart = await prisma.chart.findFirst({
    where: { weekIndex, parada: { isPrimary: true } },
    select: { weekLabel: true, dateRange: true },
    orderBy: { publishedAt: "desc" },
  });
  if (chart?.weekLabel && chart?.dateRange) {
    return { weekLabel: chart.weekLabel, dateRange: chart.dateRange };
  }
  const year = Math.floor(weekIndex / 100);
  const week = weekIndex % 100;
  return {
    weekLabel: `Semana ${week} - ${year}`,
    dateRange: chart?.dateRange ?? "",
  };
}

/** Semanas com paradas principais publicadas a partir de jan/2026. */
export async function listGlobalRankingWeekIndexes(): Promise<number[]> {
  const rows = await prisma.chart.findMany({
    where: {
      weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX },
      parada: { isPrimary: true },
    },
    select: { weekIndex: true },
    distinct: ["weekIndex"],
    orderBy: { weekIndex: "asc" },
  });
  return rows.map((r) => r.weekIndex);
}

export async function saveGlobalSnapshotForWeek(weekIndex: number, options?: { skipDeadline?: boolean }) {
  const { weekLabel, dateRange } = await resolveWeekMeta(weekIndex);
  const payload = await computeGlobalSnapshotData(weekIndex, options);
  const saved = await prisma.globalSnapshot.upsert({
    where: { weekIndex },
    update: {
      weekLabel,
      dateRange,
      weeklySongs: payload.weeklySongs as unknown as object,
      weeklyArtists: payload.weeklyArtists as unknown as object,
      overallSongs: payload.overallSongs as unknown as object,
      overallArtists: payload.overallArtists as unknown as object,
      frozenAt: new Date(),
    },
    create: {
      weekIndex,
      weekLabel,
      dateRange,
      weeklySongs: payload.weeklySongs as unknown as object,
      weeklyArtists: payload.weeklyArtists as unknown as object,
      overallSongs: payload.overallSongs as unknown as object,
      overallArtists: payload.overallArtists as unknown as object,
      frozenAt: new Date(),
    },
  });
  return { weekIndex, weekLabel, dateRange, payload: asPayload(saved) };
}

export async function rebuildAllGlobalSnapshotsFrom2026(options?: {
  onWeek?: (weekIndex: number, index: number, total: number) => void;
}) {
  const deleted = await prisma.globalSnapshot.deleteMany();
  const weekIndexes = await listGlobalRankingWeekIndexes();
  const total = weekIndexes.length;

  for (let i = 0; i < weekIndexes.length; i++) {
    const weekIndex = weekIndexes[i];
    options?.onWeek?.(weekIndex, i + 1, total);
    await saveGlobalSnapshotForWeek(weekIndex);
  }

  return { deletedCount: deleted.count, rebuiltWeeks: weekIndexes };
}

export async function refreshRankingWeekSnapshot(now: Date = new Date()) {
  const rankingWeek = getRankingWeekReference(now);
  if (!isGlobalRankingWeek(rankingWeek.weekIndex)) {
    throw new Error(`Semana ${rankingWeek.weekIndex} está fora da era Global 100 (2026+).`);
  }
  const saved = await saveGlobalSnapshotForWeek(rankingWeek.weekIndex);
  return {
    weekIndex: saved.weekIndex,
    weekLabel: saved.weekLabel,
    dateRange: saved.dateRange,
    payload: saved.payload,
  };
}
