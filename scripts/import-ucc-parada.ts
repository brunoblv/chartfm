/**
 * Importa o histórico UCC (United Community Chart) a partir da planilha Excel.
 *
 * Comunidade: hit-parade-paradas-pessoais-ucc
 * Parada oficial da comunidade (paradaName, ex.: UCC - United Community Chart)
 *
 * Formato da planilha:
 *   - Coluna D: "Artista - Música"
 *   - F1 em diante: datas das paradas (DD.MM; ano = nome da aba)
 *   - F2 em diante: posição da música na semana (vazio = fora da parada)
 *
 * Usage:
 *   npx tsx scripts/import-ucc-parada.ts --dry-run --verbose
 *   npx tsx scripts/import-ucc-parada.ts
 *   npx tsx scripts/import-ucc-parada.ts --xlsx=uploads/UCC\ \(year-end\ charts\).xlsx
 *   npx tsx scripts/import-ucc-parada.ts --from=2008-01-01 --until=2010-12-31
 *   npx tsx scripts/import-ucc-parada.ts --skip-spotify
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

const COMMUNITY_SLUG = "hit-parade-paradas-pessoais-ucc";
const DEFAULT_XLSX = join(process.cwd(), "uploads", "UCC (year-end charts).xlsx");
const PARSE_SCRIPT_PATH = join(process.cwd(), "scripts", "parse-ucc-xlsx.py");
const SPOTIFY_DELAY_MS = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const XLSX_ARG = process.argv.find((a) => a.startsWith("--xlsx="));
const FROM_ARG = process.argv.find((a) => a.startsWith("--from="));
const UNTIL_ARG = process.argv.find((a) => a.startsWith("--until="));
const XLSX_PATH = XLSX_ARG ? XLSX_ARG.split("=").slice(1).join("=") : DEFAULT_XLSX;

const FEAT_SUFFIX_RE = /\s*\((feat\.?|ft\.?|featuring)\s+([^)]+)\)\s*$/i;

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
  let text = input.trim();
  text = text.replace(/\s+(feat\.?|featuring|ft\.?|f\/|with|w\/)\s+.*$/i, "").trim();
  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return text || input.trim();
}

function parseTitleAndFeat(title: string): { baseTitle: string; featArtist: string | null } {
  const match = title.match(FEAT_SUFFIX_RE);
  if (!match) return { baseTitle: title.trim(), featArtist: null };
  return {
    baseTitle: title.slice(0, match.index).trim(),
    featArtist: match[2].trim(),
  };
}

function buildSearchQueries(artistCol: string, title: string): string[] {
  const artistClean = cleanArtistForLookup(artistCol);
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const queries = [`${baseTitle} ${artistClean}`, `${title} ${artistClean}`];
  if (featArtist) {
    queries.push(`${baseTitle} ${featArtist}`, `${baseTitle} ${featArtist} ${artistClean}`);
  }
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
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

function runPythonParser(): string {
  const args = parseArgsForPython();
  const attempts = ["python3", "python"] as const;
  let lastError: unknown;

  for (const bin of attempts) {
    try {
      return execFileSync(bin, args, {
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (err) {
      lastError = err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") continue;
    }
  }

  const err = lastError as {
    message?: string;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
    status?: number;
  };
  const stderr = err?.stderr?.toString().trim();
  const stdout = err?.stdout?.toString().trim();
  const details = [stderr, stdout].filter(Boolean).join("\n");
  throw new Error(
    `Falha ao executar parse-ucc-xlsx.py (${args.join(" ")}).` +
      (details ? `\n${details}` : `\n${err?.message ?? "python3/python não disponível"}`),
  );
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(
      `Arquivo não encontrado: ${XLSX_PATH}\n` +
        "Suba a planilha para uploads/ ou passe --xlsx=caminho/arquivo.xlsx",
    );
  }
  if (!existsSync(PARSE_SCRIPT_PATH)) throw new Error(`Parser não encontrado: ${PARSE_SCRIPT_PATH}`);

  const output = runPythonParser();
  return JSON.parse(output) as RawWeek[];
}

async function findCommunityUserAndParada() {
  const community = await prisma.community.findUnique({
    where: { slug: COMMUNITY_SLUG },
    select: { id: true, slug: true, name: true, paradaName: true, ownerId: true, maxSongs: true },
  });
  if (!community) {
    throw new Error(`Comunidade "${COMMUNITY_SLUG}" não encontrada.`);
  }
  if (!community.ownerId) {
    throw new Error(`Comunidade "${COMMUNITY_SLUG}" não tem owner definido.`);
  }

  const user = await prisma.user.findUnique({
    where: { id: community.ownerId },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Owner da comunidade não encontrado.`);

  let parada = await prisma.parada.findFirst({
    where: {
      userId: user.id,
      name: { equals: community.paradaName, mode: "insensitive" },
    },
  });

  if (!parada) {
    const sortOrder = await prisma.parada.count({ where: { userId: user.id } });
    parada = await prisma.parada.create({
      data: {
        userId: user.id,
        name: community.paradaName,
        isPrimary: false,
        sortOrder,
        chartSize: community.maxSongs ?? 20,
        cadence: "WEEKLY",
        genres: ["Pop"],
      },
    });
    console.log(`[info] Parada da comunidade criada: "${parada.name}" (${parada.id})`);
  }

  console.log(`[info] Comunidade: ${community.name} (${community.slug})`);
  console.log(`[info] Parada: "${parada.name}" (${parada.id}), chartSize=${parada.chartSize}`);
  return { community, user, parada };
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
      select: { id: true, spotifyId: true, albumSpotifyId: true, artist: true },
      take: 20,
    });

    const targetArtist = normalizeText(artistClean);
    const match =
      candidates.find((c) => normalizeText(c.artist) === targetArtist) ??
      candidates.find((c) => normalizeText(c.artist).startsWith(targetArtist)) ??
      candidates.find((c) => normalizeText(c.artist).includes(targetArtist)) ??
      candidates[0];

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
  artistCol: string,
  title: string,
  claimedThisWeek: Set<string>,
) {
  const { featArtist } = parseTitleAndFeat(title);
  const artistCandidates = [cleanArtistForLookup(artistCol), ...(featArtist ? [featArtist] : [])];
  const usable = hits.filter((hit) => hit.spotifyId && !claimedThisWeek.has(hit.spotifyId));
  if (!usable.length) return null;

  const artistMatch = usable.find((hit) => {
    const hitNorm = normalizeText(hit.artist);
    return artistCandidates.some((candidate) => {
      const candidateNorm = normalizeText(cleanArtistForLookup(candidate));
      return (
        hitNorm === candidateNorm ||
        hitNorm.includes(candidateNorm) ||
        candidateNorm.includes(hitNorm)
      );
    });
  });
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
  for (const market of ["US", "GB", "BR"]) {
    for (const query of buildSearchQueries(artistRaw, title)) {
      await sleep(SPOTIFY_DELAY_MS);
      const hits = await searchSpotifyTracks(query, 8, market);
      const best = pickBestSpotifyHit(hits, artistRaw, title, claimedThisWeek);
      if (best?.spotifyId) {
        return resolveSpotifyId(best.spotifyId, title, artistRaw);
      }
    }
  }
  return null;
}

async function importWeeks() {
  console.log(`[info] Planilha: ${XLSX_PATH}`);
  const weeks = parseWeeksFromExcel();
  console.log(`[info] Semanas parseadas: ${weeks.length} (${XLSX_PATH})`);
  if (!weeks.length) return;

  if (VERBOSE || DRY_RUN) {
    for (const week of weeks) {
      console.log(`  ${week.date}: ${week.entries.length} entradas (${week.sheet ?? "?"})`);
    }
  }

  const { community, user, parada } = await findCommunityUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const chartSize = parada.chartSize ?? 20;

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
        resolved = await resolveSongFromDb(row.title, row.artist);
        if (!resolved && !SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
          resolved = await resolveSongWithSpotify(row.title, row.artist, claimedThisWeek);
        }
        resolverCache.set(cacheKey, resolved);
        if (VERBOSE) {
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
        points: pointsForChartPosition(row.position, scoringTier, chartSize, parada.cadence),
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
      communityId: community.id,
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
        prisma.chart.update({
          where: { id: existing.id },
          data: { ...chartPayload, communityId: community.id },
        }),
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
