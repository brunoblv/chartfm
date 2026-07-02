/**
 * Importa a parada MGOLD do @ohmymog_ a partir da planilha Excel.
 *
 * Formato da planilha:
 *   - Coluna A: data da semana, depois posições (#01, #02, …)
 *   - Coluna B: artista
 *   - Coluna C: música (feats entre parênteses)
 *
 * Usage:
 *   npx tsx scripts/import-ohmymog-mgold.ts --dry-run
 *   npx tsx scripts/import-ohmymog-mgold.ts
 *   npx tsx scripts/import-ohmymog-mgold.ts --xlsx="C:\Users\...\MGOLD 2014 - 31.01.2020.xlsx"
 *   npx tsx scripts/import-ohmymog-mgold.ts --until=2020-01-31
 *   npx tsx scripts/import-ohmymog-mgold.ts --skip-spotify
 */

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
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

type RawEntry = { position: number; artist: string; title: string };
type RawWeek = { date: string; sheet?: string; entries: RawEntry[] };
type ResolvedSong = { id: string; spotifyId: string | null; albumSpotifyId: string | null };
type NotFoundRow = { weekDate: string; position: number; artist: string; title: string };

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

const HANDLE = "ohmymog_";
const PARADA_NAME = "mgold_";
const DEFAULT_XLSX = "C:\\Users\\blvbr\\Downloads\\MGOLD 2014 - 31.01.2020.xlsx";
const PARSE_SCRIPT_PATH = join(process.cwd(), "scripts", "parse-mgold-xlsx.py");
const SPOTIFY_DELAY_MS = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const XLSX_ARG = process.argv.find((a) => a.startsWith("--xlsx="));
const FROM_ARG = process.argv.find((a) => a.startsWith("--from="));
const UNTIL_ARG = process.argv.find((a) => a.startsWith("--until="));
const XLSX_PATH = XLSX_ARG ? XLSX_ARG.split("=").slice(1).join("=") : DEFAULT_XLSX;

const FEAT_SUFFIX_RE = /\s*\((feat\.?|ft\.?|featuring)\s+([^)]+)\)\s*$/i;

/** Correções manuais para faixas em que a ordem do artista na planilha não bate com o Spotify. */
const SPOTIFY_OVERRIDES: Record<string, string> = {
  "die with a smile|bruno mars": "2plbrEY59IikOBgBGLjaoe",
  "love is cruel|miles kane": "6Y8ecenZetaPf69GfAnQNG",
};

const NON_ORIGINAL_RE =
  /off vocal|instrumental|カラオケ|karaoke|remix|acoustic|live|concert|-\s*ver\.?|from the first take|cover\b/i;

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

function cleanArtistForLookup(input: string): string {
  return input.trim().replace(/\s*[,/&]\s*$/g, "").trim();
}

function parseTitleAndFeat(title: string): { baseTitle: string; featArtist: string | null } {
  const match = title.match(FEAT_SUFFIX_RE);
  if (!match) return { baseTitle: title.trim(), featArtist: null };
  return {
    baseTitle: title.slice(0, match.index).trim(),
    featArtist: match[2].trim(),
  };
}

function buildSearchQueries(artistColB: string, title: string): string[] {
  const artistClean = cleanArtistForLookup(artistColB);
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const queries = [
    `${baseTitle} ${artistClean}`,
    `${title} ${artistClean}`,
  ];
  if (featArtist) {
    queries.push(`${baseTitle} ${featArtist}`);
    queries.push(`${baseTitle} ${featArtist} ${artistClean}`);
    queries.push(`${baseTitle} ${artistClean} ${featArtist}`);
  }
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function artistMatchesAny(hitArtist: string, candidates: string[]): boolean {
  const hitNorm = normalizeText(hitArtist);
  return candidates.some((candidate) => {
    const candidateNorm = normalizeText(cleanArtistForLookup(candidate));
    return (
      hitNorm === candidateNorm ||
      hitNorm.includes(candidateNorm) ||
      candidateNorm.includes(hitNorm)
    );
  });
}

function findOverrideSpotifyId(title: string, artistRaw: string): string | null {
  const { baseTitle } = parseTitleAndFeat(title);
  const key = `${normalizeText(baseTitle)}|${normalizeText(cleanArtistForLookup(artistRaw))}`;
  return SPOTIFY_OVERRIDES[key] ?? null;
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseArgsForPython(): string[] {
  const args = [PARSE_SCRIPT_PATH, XLSX_PATH];
  if (FROM_ARG) args.push(FROM_ARG);
  if (UNTIL_ARG) args.push(UNTIL_ARG);
  return args;
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  if (!existsSync(PARSE_SCRIPT_PATH)) throw new Error(`Parser não encontrado: ${PARSE_SCRIPT_PATH}`);

  let output: string;
  try {
    output = execFileSync("python", parseArgsForPython(), { encoding: "utf-8" });
  } catch {
    output = execFileSync("python3", parseArgsForPython(), { encoding: "utf-8" });
  }

  return JSON.parse(output) as RawWeek[];
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada =
    (await prisma.parada.findFirst({
      where: { userId: user.id, name: PARADA_NAME },
    })) ??
    (await prisma.parada.findFirst({
      where: { userId: user.id, cadence: "WEEKLY", isPrimary: true },
    }));

  if (!parada) {
    throw new Error(`Parada "${PARADA_NAME}" não encontrada para @${HANDLE}.`);
  }

  console.log(`[info] Parada: "${parada.name}" (${parada.id}), chartSize=${parada.chartSize}`);
  return { user, parada };
}

async function resolveSongFromDb(title: string, artistRaw: string): Promise<ResolvedSong | null> {
  const artistClean = cleanArtistForLookup(artistRaw);
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const artistCandidates = [artistClean, ...(featArtist ? [featArtist] : [])];

  for (const titleCandidate of [title, baseTitle]) {
    const candidates = await prisma.song.findMany({
      where: {
        title: { equals: titleCandidate, mode: "insensitive" },
        OR: artistCandidates.map((artist) => ({
          artist: { contains: artist.split(" ")[0] ?? artist, mode: "insensitive" as const },
        })),
      },
      select: { id: true, spotifyId: true, albumSpotifyId: true, artist: true, title: true },
      take: 20,
    });

    const match = candidates.find((candidate) =>
      artistMatchesAny(candidate.artist, artistCandidates),
    );
    if (match) {
      return {
        id: match.id,
        spotifyId: match.spotifyId,
        albumSpotifyId: match.albumSpotifyId,
      };
    }
  }

  return null;
}

function pickBestSpotifyHit(
  hits: Awaited<ReturnType<typeof searchSpotifyTracks>>,
  artistColB: string,
  title: string,
  claimedThisWeek: Set<string>,
) {
  const { featArtist } = parseTitleAndFeat(title);
  const artistCandidates = [cleanArtistForLookup(artistColB), ...(featArtist ? [featArtist] : [])];
  const usable = hits.filter(
    (hit) => hit.spotifyId && !claimedThisWeek.has(hit.spotifyId) && !NON_ORIGINAL_RE.test(hit.title),
  );
  if (!usable.length) return null;

  const artistMatch = usable.find((hit) => artistMatchesAny(hit.artist, artistCandidates));
  return artistMatch ?? usable[0];
}

async function resolveSpotifyId(
  spotifyId: string,
  title: string,
  artistRaw: string,
): Promise<ResolvedSong | null> {
  if (DRY_RUN) {
    return { id: `dry-run:${spotifyId}`, spotifyId, albumSpotifyId: null };
  }

  const metadata = await getSpotifyTrackMetadataById(spotifyId, "US");
  if (!metadata) return null;

  const song = await upsertSongFromSpotify(metadata.spotifyId, {
    track: title,
    artist: cleanArtistForLookup(artistRaw),
    album: metadata.album.title ?? "",
  });

  return { id: song.id, spotifyId: song.spotifyId, albumSpotifyId: song.albumSpotifyId };
}

async function resolveSongWithSpotify(
  title: string,
  artistRaw: string,
  claimedThisWeek: Set<string>,
): Promise<ResolvedSong | null> {
  const artistClean = cleanArtistForLookup(artistRaw);

  for (const market of ["US", "GB", "BR"]) {
    for (const query of buildSearchQueries(artistClean, title)) {
      await sleep(SPOTIFY_DELAY_MS);
      const hits = await searchSpotifyTracks(query, 8, market);
      const best = pickBestSpotifyHit(hits, artistClean, title, claimedThisWeek);
      if (best?.spotifyId) {
        return resolveSpotifyId(best.spotifyId, title, artistClean);
      }
    }
  }

  return null;
}

async function importWeeks() {
  const weeks = parseWeeksFromExcel();
  console.log(`[info] Semanas parseadas: ${weeks.length} (${XLSX_PATH})`);
  if (!weeks.length) return;

  if (VERBOSE || DRY_RUN) {
    for (const week of weeks) {
      console.log(`  ${week.date}: ${week.entries.length} entradas (${week.sheet ?? "?"})`);
    }
  }

  const { user, parada } = await findUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);

  if (!SKIP_SPOTIFY && !process.env.SPOTIFY_CLIENT_ID) {
    console.warn("[warn] SPOTIFY_CLIENT_ID ausente — só busca no banco.");
  }

  const notFound: NotFoundRow[] = [];
  const resolverCache = new Map<string, ResolvedSong | null>();

  let createdCharts = 0;
  let updatedCharts = 0;
  let createdEntries = 0;

  for (const week of weeks) {
    const refDate = parseYmdDate(week.date);
    const weekIndex = buildWeekIndexFromDate(refDate);
    const weekLabel = buildWeekLabelFromDate(refDate);
    const dateRange = buildDateRangeFromDate(refDate);
    const { start: weekStart } = getChartWeekRange(refDate);

    const sortedEntries = [...week.entries].sort((a, b) => a.position - b.position);
    const resolvedByRow = new Map<RawEntry, ResolvedSong>();
    const claimedThisWeek = new Set<string>();

    for (const row of sortedEntries) {
      const cacheKey = `${normalizeText(row.title)}|${normalizeText(cleanArtistForLookup(row.artist))}`;
      let resolved = resolverCache.get(cacheKey) ?? null;

      if (!resolverCache.has(cacheKey)) {
        const overrideId = findOverrideSpotifyId(row.title, row.artist);
        if (overrideId && !SKIP_SPOTIFY) {
          resolved = await resolveSpotifyId(overrideId, row.title, row.artist);
        } else {
          resolved = await resolveSongFromDb(row.title, row.artist);
          if (!resolved && !SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
            resolved = await resolveSongWithSpotify(row.title, row.artist, claimedThisWeek);
          }
        }
        resolverCache.set(cacheKey, resolved);
        if (VERBOSE && !DRY_RUN) {
          console.log(
            `[resolve] ${row.artist} - ${row.title} -> ${resolved ? resolved.spotifyId : "NÃO ENCONTRADO"}`,
          );
        }
      }

      if (!resolved) {
        notFound.push({
          weekDate: week.date,
          position: row.position,
          artist: row.artist,
          title: row.title,
        });
        continue;
      }
      if (resolved.spotifyId) claimedThisWeek.add(resolved.spotifyId);
      resolvedByRow.set(row, resolved);
    }

    const finalRows = sortedEntries.filter((row) => resolvedByRow.has(row));
    if (!finalRows.length) {
      console.log(`[warn] ${week.date}: nenhuma música resolvida, pulando.`);
      continue;
    }

    const missingCount = sortedEntries.length - finalRows.length;
    if (missingCount > 0) {
      console.log(
        `[warn] ${week.date}: ${finalRows.length}/${sortedEntries.length} resolvidas (${missingCount} não encontrada(s))`,
      );
    }

    const entryPayload = finalRows.map((row) => {
      const resolved = resolvedByRow.get(row)!;
      const { palette, seed } = paletteFor(row.artist, row.title);
      return {
        position: row.position,
        songId: resolved.id,
        songSpotifyId: resolved.spotifyId,
        albumSpotifyId: resolved.albumSpotifyId,
        points: pointsForChartPosition(row.position, scoringTier, parada.chartSize, parada.cadence),
        status: "new",
        delta: null,
        prevPos: null,
        peak: row.position,
        weeks: 1,
        coverPaletteA: palette[0],
        coverPaletteB: palette[1],
        coverSeed: seed,
      };
    });

    if (DRY_RUN) {
      if (VERBOSE) {
        console.log(`[dry-run] ${week.date} -> weekIndex ${weekIndex} (${finalRows.length} entradas)`);
      }
      continue;
    }

    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      select: { id: true },
    });

    const chartPayload = {
      weekLabel,
      dateRange,
      publishedAt: refDate,
      weekStartDate: weekStart,
      maxItems: finalRows.length,
      entries: { create: entryPayload },
    };

    if (!existing) {
      await prisma.chart.create({
        data: { userId: user.id, paradaId: parada.id, weekIndex, ...chartPayload },
      });
      createdCharts += 1;
    } else {
      await prisma.$transaction([
        prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
        prisma.chart.update({ where: { id: existing.id }, data: chartPayload }),
      ]);
      updatedCharts += 1;
    }

    createdEntries += finalRows.length;
    console.log(`[ok] ${week.date} -> weekIndex ${weekIndex} (${finalRows.length} entradas)`);
  }

  if (!DRY_RUN && (createdCharts > 0 || updatedCharts > 0)) {
    const stats = await recomputePersistedChartEntryStatsForParada(prisma, parada.id);
    console.log(`[info] Stats recalculadas: ${stats.charts} charts, ${stats.entries} entradas`);

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
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts criados: ${createdCharts}`);
  console.log(`Charts atualizados: ${updatedCharts}`);
  console.log(`Entradas inseridas: ${createdEntries}`);
  console.log(`Não encontradas (BD + Spotify): ${notFound.length}`);

  if (notFound.length) {
    console.log("");
    console.log("=== NÃO ENCONTRADAS (únicas) ===");
    const unique = new Map<string, NotFoundRow>();
    for (const miss of notFound) {
      const key = `${normalizeText(miss.title)}|${normalizeText(miss.artist)}`;
      if (!unique.has(key)) unique.set(key, miss);
    }
    for (const miss of unique.values()) {
      console.log(`[miss] ${miss.artist} - ${miss.title}`);
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
