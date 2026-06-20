import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getChartWeekRange, buildDateRangeFromDate, buildWeekIndexFromDate, buildWeekLabelFromDate } from "../lib/chart-week";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";
import { searchSpotifyTracks, getSpotifyTrackMetadataById } from "../lib/spotify-server";
import { upsertSongFromSpotify } from "../lib/mytrl-weekly-chart";

type RawEntry = { position: number; artist: string; title: string };
type RawWeek = { date: string; entries: RawEntry[] };
type ResolvedSong = { id: string; spotifyId: string | null; albumSpotifyId: string | null };
type NotFoundRow = { weekDate: string; position: number; artist: string; title: string };
type BackfillRow = {
  position: number;
  artist: string;
  title: string;
  prevPosition: number;
};
type WeekEntry = {
  position: number;
  excelPosition: number | null;
  songId: string;
  songSpotifyId: string | null;
  albumSpotifyId: string | null;
  artist: string;
  title: string;
  fromDropout: boolean;
  prevPos: number | null;
  peak: number;
  weeks: number;
  status: string;
  delta: number | null;
  points: number;
};
type WeekIssue = {
  weekDate: string;
  excelCount: number;
  resolvedCount: number;
  finalCount: number;
  missingPositions: number[];
  duplicatePositions: number[];
  notFound: NotFoundRow[];
  backfilled: BackfillRow[];
  stillMissing: number;
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

const HANDLE = "bruno";
const PARADA_NAME = "Under My Skin Video";
const XLSX_PATH = join(process.cwd(), "public", "Brunos Top 20.xlsx");
const PARSE_SCRIPT_PATH = join(process.cwd(), "scripts", "parse-brunos-top20-xlsx.py");
const SPOTIFY_DELAY_MS = 450;
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const DEBUG = process.argv.includes("--debug") || DRY_RUN;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArtistForLookup(input: string): string {
  let text = input.trim();
  text = text.split("~")[0]?.trim() ?? text;
  text = text.replace(
    /\s+(feat\.?|featuring|ft\.?|f\/|with|w\/|vs\.?|x)\s+.*$/i,
    "",
  ).trim();
  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return text || input.trim();
}

/** Ignora linhas-lixo da planilha (ex.: artista "111", música "11"). */
function isValidTrack(artist: string, title: string): boolean {
  const a = artist.trim();
  const t = title.trim();
  if (a.length < 2 || t.length < 2) return false;
  if (/^\d+$/.test(a) && /^\d+$/.test(t)) return false;
  return true;
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  }
  let output: string;
  try {
    output = execFileSync("python", [PARSE_SCRIPT_PATH, XLSX_PATH], { encoding: "utf-8" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/spawnSync python ENOENT/i.test(msg)) {
      throw err;
    }
    output = execFileSync("python3", [PARSE_SCRIPT_PATH, XLSX_PATH], { encoding: "utf-8" });
  }
  const rows = JSON.parse(output) as RawWeek[];
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada = await prisma.parada.findFirst({
    where: {
      userId: user.id,
      cadence: "WEEKLY",
      OR: [
        { name: PARADA_NAME },
        {
          isPrimary: true,
          name: { contains: "Under My Skin Video", mode: "insensitive" },
        },
      ],
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  });

  if (!parada) {
    throw new Error(
      `Parada "${PARADA_NAME}" não encontrada para @${HANDLE}. Crie a parada principal antes de importar.`,
    );
  }

  if (parada.name !== PARADA_NAME) {
    console.log(`[info] Usando parada: "${parada.name}" (principal=${parada.isPrimary})`);
  } else if (!parada.isPrimary) {
    console.log(`[warn] Parada "${PARADA_NAME}" existe mas não está marcada como principal.`);
  }

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
  const exact = hits.find(
    (h) =>
      normalizeText(h.title) === titleNorm &&
      normalizeText(h.artist).split(",")[0]?.trim() === artistNorm,
  );
  if (exact) return exact;
  const close = hits.find((h) => normalizeText(h.title) === titleNorm);
  if (close) return close;
  return hits[0];
}

async function resolveSongWithSpotify(
  title: string,
  artistRaw: string,
): Promise<ResolvedSong | null> {
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

function analyzeWeekExcelEntries(entries: RawEntry[]) {
  const positions = entries.map((e) => e.position);
  const seen = new Set<number>();
  const duplicatePositions: number[] = [];
  for (const pos of positions) {
    if (seen.has(pos)) duplicatePositions.push(pos);
    seen.add(pos);
  }
  const missingPositions = Array.from({ length: 20 }, (_, i) => i + 1).filter(
    (pos) => !positions.includes(pos),
  );
  return { missingPositions, duplicatePositions: [...new Set(duplicatePositions)] };
}

function printWeekIssue(issue: WeekIssue) {
  console.log(
    `[incompleta] ${issue.weekDate}: excel=${issue.excelCount}, resolvidas=${issue.resolvedCount}, final=${issue.finalCount}`,
  );
  if (issue.missingPositions.length) {
    console.log(`  lacunas no Excel: ${issue.missingPositions.join(", ")}`);
  }
  if (issue.duplicatePositions.length) {
    console.log(`  posições duplicadas no Excel: ${issue.duplicatePositions.join(", ")}`);
  }
  if (issue.backfilled.length) {
    console.log("  completado com saídas da semana anterior:");
    for (const row of issue.backfilled) {
      console.log(
        `    #${row.position} - ${row.artist} - ${row.title} (estava #${row.prevPosition})`,
      );
    }
  }
  if (issue.stillMissing > 0) {
    console.log(
      `  ainda faltam ${issue.stillMissing} vaga(s); sem saída suficiente na semana anterior`,
    );
  }
  for (const miss of issue.notFound) {
    console.log(
      `  [miss] #${miss.position} - ${miss.artist} - ${miss.title} (não achou no BD nem no Spotify)`,
    );
  }
}

function buildFinalWeekEntries(
  weekDate: string,
  sortedExcelRows: RawEntry[],
  resolvedByRow: Map<RawEntry, ResolvedSong>,
  previousWeek: WeekEntry[] | null,
  scoringTier: ReturnType<typeof scoringTierFromPrimary>,
): { entries: WeekEntry[]; issue: WeekIssue } {
  const { missingPositions, duplicatePositions } = analyzeWeekExcelEntries(sortedExcelRows);
  const needFill = Math.max(0, 20 - sortedExcelRows.length);

  const renumbered: WeekEntry[] = sortedExcelRows.map((row, index) => {
    const resolved = resolvedByRow.get(row)!;
    const prev = previousWeek?.find((e) => e.songId === resolved.id) ?? null;
    const position = index + 1;
    const prevPos = prev?.position ?? null;
    let status = "new";
    let delta: number | null = null;
    if (prevPos != null) {
      delta = prevPos - position;
      status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
    }
    return {
      position,
      excelPosition: row.position,
      songId: resolved.id,
      songSpotifyId: resolved.spotifyId ?? null,
      albumSpotifyId: resolved.albumSpotifyId ?? null,
      artist: row.artist,
      title: row.title,
      fromDropout: false,
      prevPos,
      peak: prev ? Math.min(prev.peak, position) : position,
      weeks: prev ? prev.weeks + 1 : 1,
      status,
      delta,
      points: pointsForChartPosition(position, scoringTier, 20, "WEEKLY"),
    };
  });

  const currentSongIds = new Set(renumbered.map((e) => e.songId));
  const backfilled: BackfillRow[] = [];
  const dropoutEntries: WeekEntry[] = [];

  if (needFill > 0 && previousWeek?.length) {
    const dropouts = previousWeek
      .filter((e) => !currentSongIds.has(e.songId))
      .filter((e) => isValidTrack(e.artist, e.title))
      .sort((a, b) => a.position - b.position);

    const picks = dropouts.slice(0, needFill);
    for (let i = 0; i < picks.length; i += 1) {
      const pick = picks[i]!;
      const position = renumbered.length + i + 1;
      dropoutEntries.push({
        position,
        excelPosition: null,
        songId: pick.songId,
        songSpotifyId: pick.songSpotifyId,
        albumSpotifyId: pick.albumSpotifyId,
        artist: pick.artist,
        title: pick.title,
        fromDropout: true,
        prevPos: pick.position,
        peak: Math.min(pick.peak, position),
        weeks: pick.weeks + 1,
        status: "down",
        delta: pick.position - position,
        points: pointsForChartPosition(position, scoringTier, 20, "WEEKLY"),
      });
      backfilled.push({
        position,
        artist: pick.artist,
        title: pick.title,
        prevPosition: pick.position,
      });
    }
  }

  const entries = [...renumbered, ...dropoutEntries];
  const stillMissing = Math.max(0, 20 - entries.length);

  const issue: WeekIssue = {
    weekDate,
    excelCount: sortedExcelRows.length,
    resolvedCount: sortedExcelRows.length,
    finalCount: entries.length,
    missingPositions,
    duplicatePositions,
    notFound: [],
    backfilled,
    stillMissing,
  };

  return { entries, issue };
}

async function importWeeks() {
  const weeks = parseWeeksFromExcel();
  console.log(`[info] Semanas válidas encontradas: ${weeks.length}`);
  if (!weeks.length) return;

  const { user, parada } = await findUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const notFound: NotFoundRow[] = [];
  const weekIssues: WeekIssue[] = [];
  const resolverCache = new Map<string, ResolvedSong | null>();
  let previousWeek: WeekEntry[] | null = null;

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
    const weekNotFound: NotFoundRow[] = [];
    const resolvedByRow = new Map<RawEntry, ResolvedSong>();

    for (const row of sortedEntries) {
      if (!isValidTrack(row.artist, row.title)) continue;

      const cacheKey = `${normalizeText(row.title)}|${normalizeText(cleanArtistForLookup(row.artist))}`;
      let resolved = resolverCache.get(cacheKey) ?? null;
      if (!resolverCache.has(cacheKey)) {
        resolved = await resolveSongFromDb(row.title, row.artist);
        if (!resolved) {
          resolved = await resolveSongWithSpotify(row.title, row.artist);
        }
        resolverCache.set(cacheKey, resolved);
      }

      if (!resolved) {
        const miss = {
          weekDate: week.date,
          position: row.position,
          artist: row.artist,
          title: row.title,
        };
        notFound.push(miss);
        weekNotFound.push(miss);
        continue;
      }

      resolvedByRow.set(row, resolved);
    }

    const resolvedExcelRows = sortedEntries.filter((row) => resolvedByRow.has(row));
    const { entries: finalEntries, issue } = buildFinalWeekEntries(
      week.date,
      resolvedExcelRows,
      resolvedByRow,
      previousWeek,
      scoringTier,
    );
    issue.notFound = weekNotFound;

    const hasIssue =
      issue.excelCount < 20 ||
      issue.missingPositions.length > 0 ||
      issue.duplicatePositions.length > 0 ||
      issue.notFound.length > 0 ||
      issue.backfilled.length > 0 ||
      issue.stillMissing > 0;

    if (hasIssue) {
      weekIssues.push(issue);
    }

    if (!finalEntries.length) {
      console.log(`[warn] Semana ${week.date} sem entradas resolvidas, pulando.`);
      continue;
    }

    previousWeek = finalEntries.filter((e) => isValidTrack(e.artist, e.title));

    if (DRY_RUN) {
      if (DEBUG && hasIssue) {
        printWeekIssue(issue);
      } else if (VERBOSE) {
        console.log(`[dry-run] Semana ${week.date}: ${finalEntries.length} entradas.`);
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
      maxItems: finalEntries.length,
      entries: {
        create: finalEntries.map((e) => ({
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
        })),
      },
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
      createdEntries += finalEntries.length;
    } else {
      await prisma.$transaction([
        prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
        prisma.chart.update({
          where: { id: existing.id },
          data: chartPayload,
        }),
      ]);
      updatedCharts += 1;
      createdEntries += finalEntries.length;
    }

    console.log(
      `[ok] ${week.date} -> weekIndex ${weekIndex} (${finalEntries.length} entradas${issue.backfilled.length ? `, +${issue.backfilled.length} saídas` : ""})`,
    );
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts criados: ${createdCharts}`);
  console.log(`Charts atualizados: ${updatedCharts}`);
  console.log(`Entradas inseridas: ${createdEntries}`);
  console.log(`Não encontradas (BD + Spotify): ${notFound.length}`);
  console.log(`Semanas com lacunas/backfill: ${weekIssues.length}`);

  if (notFound.length) {
    console.log("");
    console.log("=== NÃO ENCONTRADAS (BD + Spotify) ===");
    for (const miss of notFound) {
      console.log(
        `[miss] ${miss.weekDate} #${miss.position} - ${miss.artist} - ${miss.title}`,
      );
    }
  }

  if (weekIssues.length) {
    console.log("");
    console.log("=== SEMANAS COM LACUNAS / BACKFILL ===");
    for (const issue of weekIssues) {
      printWeekIssue(issue);
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
