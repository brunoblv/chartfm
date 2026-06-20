/**
 * Importa paradas TOP 30 do @leoxavier a partir de arquivo texto.
 *
 * Formato esperado:
 *   DD/MM/YYYY ou D/M/YYYY
 *   01. Artista - Música
 *   (Nweeks/.../Peak:NN)   ← ignorado
 *   Falloffs:              ← ignorado até próxima data
 *
 * Usage:
 *   npx tsx scripts/import-leoxavier-top30.ts --dry-run
 *   npx tsx scripts/import-leoxavier-top30.ts
 *   npx tsx scripts/import-leoxavier-top30.ts --file="C:\Users\...\TOP 30 - 2026.txt"
 *   npx tsx scripts/import-leoxavier-top30.ts --skip-spotify
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  buildDateRangeFromDate,
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  getChartWeekRange,
} from "../lib/chart-week";
import { computeStreakForCadence } from "../lib/chart-cadence";
import { recomputePersistedChartEntryStatsForParada } from "../lib/chart-entry-stats";
import { paletteFor, upsertSongFromSpotify } from "../lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";
import { getSpotifyTrackMetadataById, searchSpotifyTracks } from "../lib/spotify-server";

type RawEntry = { position: number; artist: string; title: string; order: number };
type RawWeek = { date: string; entries: RawEntry[] };
type ResolvedSong = { id: string; spotifyId: string | null; albumSpotifyId: string | null };
type NotFoundRow = { weekDate: string; position: number; artist: string; title: string; source: "db" | "spotify" };

type WeekEntry = {
  position: number;
  songId: string;
  songSpotifyId: string | null;
  albumSpotifyId: string | null;
  artist: string;
  title: string;
  prevPos: number | null;
  peak: number;
  weeks: number;
  status: string;
  delta: number | null;
  points: number;
};

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const prisma = new PrismaClient();

const HANDLE = "leoxavier";
const DEFAULT_TXT = "C:\\Users\\blvbr\\Downloads\\TOP 30 - 2026.txt";
const EXPECTED_YEAR = 2026;
const CHART_SIZE = 30;
const SPOTIFY_DELAY_MS = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const FILE_ARG = process.argv.find((a) => a.startsWith("--file="));
const TXT_PATH = FILE_ARG ? FILE_ARG.split("=").slice(1).join("=") : DEFAULT_TXT;

const DATE_LINE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const ENTRY_LINE_RE = /^(\d{2})\.\s+(.+)$/;
const STATS_LINE_RE = /^\(\d+weeks/i;
const DEBUT_ONLY_RE = /^\[DEBUT\]$/i;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\[DEBUT\]\s*$/i, "")
    .replace(/\s*\(\d+weeks[^)]*\)\s*$/i, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function parseArtistTitle(text: string): { artist: string; title: string } | null {
  const cleaned = text.replace(/\u00a0/g, " ").trim();
  const dash = cleaned.search(/\s+-\s+/);
  if (dash === -1) return null;
  const artist = cleaned.slice(0, dash).trim();
  const title = cleanTitle(cleaned.slice(dash).replace(/^\s+-\s+/, ""));
  if (!artist || !title) return null;
  return { artist, title };
}

function cleanArtistForLookup(input: string): string {
  let text = input.trim();
  text = text.split("~")[0]?.trim() ?? text;
  text = text
    .replace(/\s+(feat\.?|featuring|ft\.?|f\/|with|w\/|vs\.?|x)\s+.*$/i, "")
    .trim();
  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return text || input.trim();
}

function fixYear(day: number, month: number, year: number): number {
  if (year === EXPECTED_YEAR - 1 && month === 1) return EXPECTED_YEAR;
  return year;
}

function toYmd(day: number, month: number, year: number): string {
  const y = fixYear(day, month, year);
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseTop30Text(content: string): RawWeek[] {
  const weeks: RawWeek[] = [];
  let current: RawWeek | null = null;
  let inFalloffs = false;
  let entryOrder = 0;

  const flushWeek = () => {
    if (current && current.entries.length > 0) {
      current.entries = normalizeWeekPositions(current.date, current.entries);
      weeks.push(current);
    }
    current = null;
    entryOrder = 0;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^TOP\s+30/i.test(line)) continue;

    const dateMatch = line.match(DATE_LINE_RE);
    if (dateMatch) {
      flushWeek();
      inFalloffs = false;
      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const year = Number(dateMatch[3]);
      current = { date: toYmd(day, month, year), entries: [] };
      continue;
    }

    if (/^Falloffs:/i.test(line)) {
      inFalloffs = true;
      continue;
    }

    if (inFalloffs || STATS_LINE_RE.test(line) || DEBUT_ONLY_RE.test(line)) {
      continue;
    }

    const entryMatch = line.match(ENTRY_LINE_RE);
    if (!entryMatch || !current) continue;

    const position = Number(entryMatch[1]);
    const parsed = parseArtistTitle(entryMatch[2]);
    if (!parsed) {
      console.warn(`[parse] Linha ignorada (sem artista - título): ${line}`);
      continue;
    }

    current.entries.push({
      position,
      artist: parsed.artist,
      title: parsed.title,
      order: entryOrder++,
    });
  }

  flushWeek();

  const byDate = new Map<string, RawWeek>();
  for (const week of weeks) {
    if (byDate.has(week.date)) {
      console.warn(`[parse] Data duplicada ${week.date} — mantendo última ocorrência`);
    }
    byDate.set(week.date, week);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Corrige posições duplicadas ou lacunas renumerando pela ordem do arquivo. */
function normalizeWeekPositions(weekDate: string, entries: RawEntry[]): RawEntry[] {
  const sorted = [...entries].sort((a, b) => a.position - b.position || a.order - b.order);
  const positions = sorted.map((e) => e.position);
  const hasDuplicate = new Set(positions).size !== positions.length;
  const expected = sorted.length;
  const hasGap =
    positions.length > 0 &&
    (positions[0] !== 1 ||
      positions.some((p, i) => i > 0 && p <= positions[i - 1]!) ||
      positions[positions.length - 1] !== expected);

  if (!hasDuplicate && !hasGap) return sorted;

  console.warn(
    `[parse] ${weekDate}: posições irregulares (${positions.join(", ")}) — renumerando 1..${expected}`,
  );
  return sorted.map((entry, index) => ({ ...entry, position: index + 1 }));
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada = await prisma.parada.findFirst({
    where: {
      userId: user.id,
      cadence: "WEEKLY",
      OR: [
        { isPrimary: true },
        { name: { contains: "Top 30", mode: "insensitive" } },
      ],
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  });

  if (!parada) {
    throw new Error(`Nenhuma parada semanal encontrada para @${HANDLE}.`);
  }

  console.log(`[info] Parada: "${parada.name}" (${parada.id})`);
  return { user, parada };
}

async function resolveSongFromDb(title: string, artistRaw: string): Promise<ResolvedSong | null> {
  const artistClean = cleanArtistForLookup(artistRaw);
  const candidates = await prisma.song.findMany({
    where: {
      title: { equals: title, mode: "insensitive" },
      artist: { contains: artistClean.split(" ")[0] ?? artistClean, mode: "insensitive" },
    },
    select: { id: true, spotifyId: true, albumSpotifyId: true, artist: true },
    take: 20,
  });
  if (!candidates.length) return null;

  const targetArtist = normalizeText(artistClean);
  const exact = candidates.find((c) => normalizeText(c.artist) === targetArtist);
  if (exact) return { id: exact.id, spotifyId: exact.spotifyId, albumSpotifyId: exact.albumSpotifyId };

  const starts = candidates.find((c) => normalizeText(c.artist).startsWith(targetArtist));
  if (starts) return { id: starts.id, spotifyId: starts.spotifyId, albumSpotifyId: starts.albumSpotifyId };

  const contains = candidates.find((c) => normalizeText(c.artist).includes(targetArtist));
  if (contains) return { id: contains.id, spotifyId: contains.spotifyId, albumSpotifyId: contains.albumSpotifyId };

  const first = candidates[0];
  return { id: first.id, spotifyId: first.spotifyId, albumSpotifyId: first.albumSpotifyId };
}

function pickBestSpotifyHit(
  hits: Awaited<ReturnType<typeof searchSpotifyTracks>>,
  title: string,
  artistClean: string,
) {
  if (!hits.length) return null;
  const titleNorm = normalizeText(title);
  const artistNorm = normalizeText(artistClean);
  const artistFirst = artistNorm.split(",")[0]?.trim() ?? artistNorm;

  const exact = hits.find(
    (h) =>
      normalizeText(h.title) === titleNorm &&
      normalizeText(h.artist).split(",")[0]?.trim() === artistFirst,
  );
  if (exact) return exact;

  const closeTitle = hits.find((h) => normalizeText(h.title) === titleNorm);
  if (closeTitle) return closeTitle;

  return hits[0];
}

async function resolveSongWithSpotify(title: string, artistRaw: string): Promise<ResolvedSong | null> {
  const artistClean = cleanArtistForLookup(artistRaw);
  await sleep(SPOTIFY_DELAY_MS);
  const hits = await searchSpotifyTracks(`${title} ${artistClean}`, 8, "BR");
  const best = pickBestSpotifyHit(hits, title, artistClean);
  if (!best?.spotifyId) return null;

  if (DRY_RUN) {
    return {
      id: `dry-run:${best.spotifyId}`,
      spotifyId: best.spotifyId,
      albumSpotifyId: null,
    };
  }

  const metadata = await getSpotifyTrackMetadataById(best.spotifyId, "BR");
  if (!metadata) return null;

  const song = await upsertSongFromSpotify(metadata.spotifyId, {
    track: title,
    artist: artistClean,
    album: metadata.album.title ?? best.album,
  });

  return {
    id: song.id,
    spotifyId: song.spotifyId,
    albumSpotifyId: song.albumSpotifyId,
  };
}

function buildWeekEntries(
  rows: RawEntry[],
  resolvedByRow: Map<RawEntry, ResolvedSong>,
  previousWeek: WeekEntry[] | null,
  scoringTier: ReturnType<typeof scoringTierFromPrimary>,
  chartSize: number,
): WeekEntry[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  return sorted.map((row) => {
    const resolved = resolvedByRow.get(row)!;
    const prev = previousWeek?.find((e) => e.songId === resolved.id) ?? null;
    const position = row.position;
    const prevPos = prev?.position ?? null;
    let status = "new";
    let delta: number | null = null;

    if (prevPos != null) {
      delta = prevPos - position;
      status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
    } else if (previousWeek?.some((e) => e.songId === resolved.id)) {
      status = "return";
    }

    const { palette, seed } = paletteFor(row.artist, row.title);

    return {
      position,
      songId: resolved.id,
      songSpotifyId: resolved.spotifyId,
      albumSpotifyId: resolved.albumSpotifyId,
      artist: row.artist,
      title: row.title,
      prevPos,
      peak: prev ? Math.min(prev.peak, position) : position,
      weeks: prev ? prev.weeks + 1 : 1,
      status,
      delta,
      points: pointsForChartPosition(position, scoringTier, chartSize, "WEEKLY"),
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    } as WeekEntry & { coverPaletteA: string; coverPaletteB: string; coverSeed: number };
  });
}

async function importWeeks() {
  if (!existsSync(TXT_PATH)) {
    throw new Error(`Arquivo não encontrado: ${TXT_PATH}`);
  }

  const weeks = parseTop30Text(readFileSync(TXT_PATH, "utf-8"));
  console.log(`[info] Semanas parseadas: ${weeks.length} (${TXT_PATH})`);
  if (!weeks.length) return;

  if (VERBOSE || DRY_RUN) {
    for (const w of weeks) {
      console.log(`  ${w.date}: ${w.entries.length} entradas`);
    }
  }

  const { user, parada } = await findUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const chartSize = parada.chartSize ?? CHART_SIZE;

  if (!SKIP_SPOTIFY && !process.env.SPOTIFY_CLIENT_ID) {
    console.warn("[warn] SPOTIFY_CLIENT_ID ausente — só busca no banco.");
  }

  const notFound: NotFoundRow[] = [];
  const resolverCache = new Map<string, ResolvedSong | null>();
  let previousWeek: WeekEntry[] | null = null;

  let createdCharts = 0;
  let updatedCharts = 0;
  let skippedCharts = 0;
  let createdEntries = 0;

  for (const week of weeks) {
    const refDate = parseYmdDate(week.date);
    const weekIndex = buildWeekIndexFromDate(refDate);
    const weekLabel = buildWeekLabelFromDate(refDate);
    const dateRange = buildDateRangeFromDate(refDate);
    const { start: weekStart } = getChartWeekRange(refDate);

    const sortedEntries = [...week.entries].sort((a, b) => a.position - b.position);
    const resolvedByRow = new Map<RawEntry, ResolvedSong>();

    for (const row of sortedEntries) {
      const cacheKey = `${normalizeText(row.title)}|${normalizeText(cleanArtistForLookup(row.artist))}`;
      let resolved = resolverCache.get(cacheKey) ?? null;

      if (!resolverCache.has(cacheKey)) {
        resolved = await resolveSongFromDb(row.title, row.artist);
        if (!resolved && !SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
          resolved = await resolveSongWithSpotify(row.title, row.artist);
        }
        resolverCache.set(cacheKey, resolved);
      }

      if (!resolved) {
        notFound.push({
          weekDate: week.date,
          position: row.position,
          artist: row.artist,
          title: row.title,
          source: "spotify",
        });
        continue;
      }

      resolvedByRow.set(row, resolved);
    }

    if (resolvedByRow.size === 0) {
      console.log(`[warn] ${week.date}: nenhuma música resolvida, pulando.`);
      continue;
    }

    const finalEntries = buildWeekEntries(
      sortedEntries.filter((r) => resolvedByRow.has(r)),
      resolvedByRow,
      previousWeek,
      scoringTier,
      chartSize,
    ) as (WeekEntry & { coverPaletteA: string; coverPaletteB: string; coverSeed: number })[];

    previousWeek = finalEntries;

    const missingCount = sortedEntries.length - finalEntries.length;
    if (missingCount > 0) {
      console.log(
        `[warn] ${week.date}: ${finalEntries.length}/${sortedEntries.length} resolvidas (${missingCount} não encontrada(s))`,
      );
    }

    if (DRY_RUN) {
      if (VERBOSE) {
        console.log(`[dry-run] ${week.date} -> weekIndex ${weekIndex} (${finalEntries.length} entradas)`);
      }
      continue;
    }

    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      select: { id: true },
    });

    const entryPayload = finalEntries.map((e) => ({
      position: e.position,
      songId: e.songId,
      songSpotifyId: e.songSpotifyId,
      albumSpotifyId: e.albumSpotifyId,
      points: e.points,
      status: e.status,
      delta: e.delta,
      prevPos: e.prevPos,
      peak: e.peak,
      weeks: e.weeks,
      coverPaletteA: e.coverPaletteA,
      coverPaletteB: e.coverPaletteB,
      coverSeed: e.coverSeed,
    }));

    const chartPayload = {
      weekLabel,
      dateRange,
      publishedAt: refDate,
      weekStartDate: weekStart,
      maxItems: finalEntries.length,
      entries: { create: entryPayload },
    };

    if (!existing) {
      await prisma.chart.create({
        data: {
          userId: user.id,
          paradaId: parada.id,
          weekIndex,
          ...chartPayload,
        },
      });
      createdCharts += 1;
    } else {
      await prisma.$transaction([
        prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
        prisma.chart.update({
          where: { id: existing.id },
          data: chartPayload,
        }),
      ]);
      updatedCharts += 1;
    }

    createdEntries += finalEntries.length;
    console.log(`[ok] ${week.date} -> weekIndex ${weekIndex} (${finalEntries.length} entradas)`);
  }

  if (!DRY_RUN && (createdCharts > 0 || updatedCharts > 0)) {
    const minWeek = weeks.reduce(
      (min, w) => Math.min(min, buildWeekIndexFromDate(parseYmdDate(w.date))),
      Infinity,
    );
    await recomputePersistedChartEntryStatsForParada(prisma, parada.id, minWeek);

    if (parada.isPrimary) {
      const primaryWeeks = await prisma.chart.findMany({
        where: { userId: user.id, paradaId: parada.id },
        select: { weekIndex: true },
        orderBy: { weekIndex: "desc" },
      });
      const streak = computeStreakForCadence(primaryWeeks.map((w) => w.weekIndex), "WEEKLY");
      await prisma.user.update({ where: { id: user.id }, data: { streak } });
      console.log(`[info] Streak atualizado: ${streak}`);
    }
  } else if (DRY_RUN) {
    skippedCharts = weeks.length;
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts criados: ${createdCharts}`);
  console.log(`Charts atualizados: ${updatedCharts}`);
  if (DRY_RUN) console.log(`Semanas simuladas: ${skippedCharts}`);
  console.log(`Entradas inseridas: ${createdEntries}`);
  console.log(`Não encontradas (BD + Spotify): ${notFound.length}`);

  if (notFound.length) {
    console.log("");
    console.log("=== NÃO ENCONTRADAS ===");
    const unique = new Map<string, NotFoundRow>();
    for (const miss of notFound) {
      const key = `${normalizeText(miss.title)}|${normalizeText(miss.artist)}`;
      if (!unique.has(key)) unique.set(key, miss);
    }
    for (const miss of unique.values()) {
      console.log(`[miss] ${miss.artist} - ${miss.title}`);
    }
    console.log("");
    console.log("=== DETALHE POR SEMANA ===");
    for (const miss of notFound) {
      console.log(`[miss] ${miss.weekDate} #${String(miss.position).padStart(2, "0")} - ${miss.artist} - ${miss.title}`);
    }
  }
}

importWeeks()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
