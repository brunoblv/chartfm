import { prisma } from "./prisma";
import { buildDateRangeFromDate, buildWeekIndexFromDate, buildWeekLabelFromDate, getChartWeekRange } from "./chart-week";
import { pointsForChartPosition, scoringTierFromPrimary } from "./parada-points";
import { paletteFor } from "./mytrl-weekly-chart";
import { fetchGenreCandidates, resolveGenreSong, normalizeKey } from "./genre-parada-source";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Só considera a parada "vencida" quando já passou ~6.5 dias — evita reprocessar
// no mesmo dia por causa de pequenas variações no horário do cron.
const DUE_THRESHOLD_MS = WEEK_MS - 12 * 60 * 60 * 1000;
const RECENT_WEEKS_LOOKBACK = 4;
const MIN_MOVE = 1;
const MAX_MOVE = 7;

function randomMove(): number {
  return MIN_MOVE + Math.floor(Math.random() * (MAX_MOVE - MIN_MOVE + 1));
}

type PrevEntry = {
  position: number;
  songId: string;
  songSpotifyId: string | null;
  peak: number;
  weeks: number;
};

/** Próxima semana (mesmo dia da semana e horário) a partir da última publicação. */
function nextAnchorFrom(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + WEEK_MS);
}

async function advanceOneParada(parada: {
  id: string;
  userId: string;
  name: string;
  genres: string[];
  chartSize: number | null;
  sourceLastfmUsers: string[];
}) {
  const charts = await prisma.chart.findMany({
    where: { paradaId: parada.id },
    orderBy: { weekIndex: "desc" },
    take: RECENT_WEEKS_LOOKBACK,
    include: { entries: { include: { song: true } } },
  });

  const latest = charts[0];
  if (!latest) return { paradaId: parada.id, skipped: "sem edição anterior" };

  const age = Date.now() - latest.publishedAt.getTime();
  if (age < DUE_THRESHOLD_MS) return { paradaId: parada.id, skipped: "ainda não venceu" };

  const nextAnchor = nextAnchorFrom(latest.publishedAt);
  const nextWeekIndex = buildWeekIndexFromDate(nextAnchor);
  if (nextWeekIndex === latest.weekIndex) return { paradaId: parada.id, skipped: "mesma semana" };

  const existingNext = await prisma.chart.findUnique({
    where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex: nextWeekIndex } },
    select: { id: true },
  });
  if (existingNext) return { paradaId: parada.id, skipped: "próxima edição já existe" };

  const maxItems = parada.chartSize ?? latest.entries.length;

  const prevEntries: PrevEntry[] = latest.entries
    .map((e) => ({ position: e.position, songId: e.songId, songSpotifyId: e.songSpotifyId, peak: e.peak, weeks: e.weeks }))
    .sort((a, b) => a.position - b.position);

  // Metade de cima da parada cai 1-7 posições (quem cair além do tamanho sai);
  // metade de baixo sobe 1-7 posições (nunca sai, só se aproxima do topo).
  const half = Math.ceil(maxItems / 2);
  const fallen = prevEntries
    .map((e) =>
      e.position <= half
        ? { ...e, rawPos: e.position + randomMove() }
        : { ...e, rawPos: Math.max(1, e.position - randomMove()) },
    )
    .filter((e) => e.rawPos <= maxItems)
    .sort((a, b) => a.rawPos - b.rawPos || a.position - b.position);

  const slotsForNewEntrants = Math.max(0, maxItems - fallen.length);

  // Não deixa reentrar uma faixa vista nas últimas semanas.
  const excludeKeys = new Set<string>();
  for (const chart of charts) {
    for (const entry of chart.entries) {
      excludeKeys.add(`${normalizeKey(entry.song.title)}|||${normalizeKey(entry.song.artist)}`);
    }
  }

  let newEntrantSongs: Array<{ title: string; artist: string; song: { id: string; spotifyId: string | null } }> = [];
  if (slotsForNewEntrants > 0 && parada.sourceLastfmUsers.length > 0) {
    const { candidates } = await fetchGenreCandidates(parada.sourceLastfmUsers, parada.genres, slotsForNewEntrants, excludeKeys);
    for (const c of candidates) {
      const resolved = await resolveGenreSong(c.track, c.artist);
      if (!resolved) continue;
      newEntrantSongs.push({ title: c.track, artist: c.artist, song: resolved });
      if (newEntrantSongs.length >= slotsForNewEntrants) break;
    }
  }

  const scoringTier = scoringTierFromPrimary(false);
  const entryPayload: Array<{
    position: number;
    songId: string;
    songSpotifyId: string | null;
    points: number;
    status: string;
    delta: number | null;
    prevPos: number | null;
    peak: number;
    weeks: number;
    coverPaletteA: string;
    coverPaletteB: string;
    coverSeed: number;
  }> = [];

  let position = 1;
  for (const n of newEntrantSongs) {
    const { palette, seed } = paletteFor(n.artist, n.title);
    entryPayload.push({
      position,
      songId: n.song.id,
      songSpotifyId: n.song.spotifyId,
      points: pointsForChartPosition(position, scoringTier, maxItems, "WEEKLY"),
      status: "new",
      delta: null,
      prevPos: null,
      peak: position,
      weeks: 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    });
    position++;
  }

  for (const f of fallen) {
    const song = latest.entries.find((e) => e.songId === f.songId)!.song;
    const { palette, seed } = paletteFor(song.artist, song.title);
    const delta = f.position - position;
    entryPayload.push({
      position,
      songId: f.songId,
      songSpotifyId: f.songSpotifyId,
      points: pointsForChartPosition(position, scoringTier, maxItems, "WEEKLY"),
      status: delta > 0 ? "up" : delta < 0 ? "down" : "same",
      delta,
      prevPos: f.position,
      peak: Math.min(f.peak, position),
      weeks: f.weeks + 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    });
    position++;
  }

  if (!entryPayload.length) return { paradaId: parada.id, skipped: "nenhuma entrada resultante" };

  const weekLabel = buildWeekLabelFromDate(nextAnchor);
  const dateRange = buildDateRangeFromDate(nextAnchor);
  const { start: weekStartDate } = getChartWeekRange(nextAnchor);

  await prisma.chart.create({
    data: {
      userId: parada.userId,
      paradaId: parada.id,
      weekIndex: nextWeekIndex,
      weekLabel,
      dateRange,
      publishedAt: nextAnchor,
      postedAt: nextAnchor,
      weekStartDate,
      maxItems,
      isPublished: true,
      entries: { create: entryPayload },
    },
  });

  return {
    paradaId: parada.id,
    name: parada.name,
    weekIndex: nextWeekIndex,
    entries: entryPayload.length,
    newEntrants: newEntrantSongs.length,
    droppedOut: prevEntries.length - fallen.length,
  };
}

/** Roda para todas as paradas com auto_decay=true cuja próxima edição já venceu (~7 dias). */
export async function advanceAutoDecayParadas() {
  const paradas = await prisma.parada.findMany({
    where: { autoDecay: true, deletedAt: null },
    select: { id: true, userId: true, name: true, genres: true, chartSize: true, sourceLastfmUsers: true },
  });

  const results = [];
  for (const parada of paradas) {
    try {
      results.push(await advanceOneParada(parada));
    } catch (err) {
      results.push({ paradaId: parada.id, error: String((err as Error)?.message ?? err) });
    }
  }
  return results;
}
