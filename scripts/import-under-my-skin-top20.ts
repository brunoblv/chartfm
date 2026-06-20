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
const PARADA_NAME = "Under My Skin Video Countdown (Top 20)";
const XLSX_PATH = join(process.cwd(), "public", "Brunos Top 20.xlsx");
const PARSE_SCRIPT_PATH = join(process.cwd(), "scripts", "parse-brunos-top20-xlsx.py");
const SPOTIFY_DELAY_MS = 450;
const DRY_RUN = process.argv.includes("--dry-run");

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

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  }
  const output = execFileSync("python", [PARSE_SCRIPT_PATH, XLSX_PATH], { encoding: "utf-8" });
  const rows = JSON.parse(output) as RawWeek[];
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  let parada = await prisma.parada.findFirst({
    where: { userId: user.id, name: PARADA_NAME, cadence: "WEEKLY" },
  });
  if (!parada) {
    const currentMaxSort = await prisma.parada.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });
    parada = await prisma.parada.create({
      data: {
        userId: user.id,
        name: PARADA_NAME,
        isPrimary: false,
        cadence: "WEEKLY",
        sortOrder: (currentMaxSort._max.sortOrder ?? -1) + 1,
        chartSize: 20,
      },
    });
    console.log(`[info] Parada criada: ${PARADA_NAME}`);
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

async function importWeeks() {
  const weeks = parseWeeksFromExcel();
  console.log(`[info] Semanas válidas encontradas: ${weeks.length}`);
  if (!weeks.length) return;

  const { user, parada } = await findUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
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

    const sortedEntries = [...week.entries].sort((a, b) => a.position - b.position).slice(0, 20);
    const finalEntries: Array<{
      position: number;
      songId: string;
      songSpotifyId: string | null;
      albumSpotifyId: string | null;
      points: number;
    }> = [];

    for (const row of sortedEntries) {
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
        notFound.push({
          weekDate: week.date,
          position: row.position,
          artist: row.artist,
          title: row.title,
        });
        continue;
      }

      finalEntries.push({
        position: row.position,
        songId: resolved.id,
        songSpotifyId: resolved.spotifyId ?? null,
        albumSpotifyId: resolved.albumSpotifyId ?? null,
        points: pointsForChartPosition(row.position, scoringTier, 20, "WEEKLY"),
      });
    }

    if (!finalEntries.length) {
      console.log(`[warn] Semana ${week.date} sem entradas resolvidas, pulando.`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] Semana ${week.date}: ${finalEntries.length} entradas.`);
      continue;
    }

    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      select: { id: true },
    });

    if (!existing) {
      await prisma.chart.create({
        data: {
          userId: user.id,
          paradaId: parada.id,
          weekIndex,
          weekLabel,
          dateRange,
          publishedAt: refDate,
          weekStartDate: weekStart,
          maxItems: 20,
          entries: {
            create: finalEntries.map((e) => ({
              position: e.position,
              songId: e.songId,
              songSpotifyId: e.songSpotifyId,
              albumSpotifyId: e.albumSpotifyId,
              points: e.points,
              status: "new",
              delta: null,
              prevPos: null,
              peak: e.position,
              weeks: 1,
            })),
          },
        },
      });
      createdCharts += 1;
      createdEntries += finalEntries.length;
    } else {
      await prisma.$transaction([
        prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
        prisma.chart.update({
          where: { id: existing.id },
          data: {
            weekLabel,
            dateRange,
            publishedAt: refDate,
            weekStartDate: weekStart,
            maxItems: 20,
            entries: {
              create: finalEntries.map((e) => ({
                position: e.position,
                songId: e.songId,
                songSpotifyId: e.songSpotifyId,
                albumSpotifyId: e.albumSpotifyId,
                points: e.points,
                status: "new",
                delta: null,
                prevPos: null,
                peak: e.position,
                weeks: 1,
              })),
            },
          },
        }),
      ]);
      updatedCharts += 1;
      createdEntries += finalEntries.length;
    }

    console.log(
      `[ok] ${week.date} -> weekIndex ${weekIndex} (${finalEntries.length} entradas)`,
    );
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts criados: ${createdCharts}`);
  console.log(`Charts atualizados: ${updatedCharts}`);
  console.log(`Entradas inseridas: ${createdEntries}`);
  console.log(`Não encontradas (BD + Spotify): ${notFound.length}`);
  if (notFound.length) {
    for (const miss of notFound) {
      console.log(
        `[miss] ${miss.weekDate} #${miss.position} - ${miss.artist} - ${miss.title}`,
      );
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
