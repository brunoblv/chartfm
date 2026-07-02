/**
 * Insere entradas faltantes na parada MGOLD do @ohmymog_ usando IDs do Spotify.
 *
 * Usage:
 *   npx tsx scripts/fix-ohmymog-mgold-missing.ts --dry-run
 *   npx tsx scripts/fix-ohmymog-mgold-missing.ts
 */

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildWeekIndexFromDate } from "../lib/chart-week";
import { recomputePersistedChartEntryStatsForParada } from "../lib/chart-entry-stats";
import { paletteFor, upsertSongFromSpotify } from "../lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";
import { getSpotifyTrackMetadataById } from "../lib/spotify-server";

type RawEntry = { position: number; artist: string; title: string };
type RawWeek = { date: string; entries: RawEntry[] };

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

const DRY_RUN = process.argv.includes("--dry-run");
const XLSX_ARG = process.argv.find((a) => a.startsWith("--xlsx="));
const XLSX_PATH = XLSX_ARG ? XLSX_ARG.split("=").slice(1).join("=") : DEFAULT_XLSX;

/** Faixas não resolvidas no import + ID correto no Spotify. */
const MANUAL_TRACKS: Array<{
  artistMatch: string;
  titleMatch: string;
  spotifyId: string;
}> = [
  {
    artistMatch: "bruno mars",
    titleMatch: "die with a smile",
    spotifyId: "2plbrEY59IikOBgBGLjaoe",
  },
  {
    artistMatch: "miles kane",
    titleMatch: "love is cruel",
    spotifyId: "6Y8ecenZetaPf69GfAnQNG",
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTrack(entry: RawEntry, spec: (typeof MANUAL_TRACKS)[number]): boolean {
  return (
    normalizeText(entry.artist).includes(spec.artistMatch) &&
    normalizeText(entry.title).includes(spec.titleMatch)
  );
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  let output: string;
  try {
    output = execFileSync("python", [PARSE_SCRIPT_PATH, XLSX_PATH], { encoding: "utf-8" });
  } catch {
    output = execFileSync("python3", [PARSE_SCRIPT_PATH, XLSX_PATH], { encoding: "utf-8" });
  }
  return JSON.parse(output) as RawWeek[];
}

function collectFixes(weeks: RawWeek[]) {
  const fixes: Array<{
    weekDate: string;
    position: number;
    artist: string;
    title: string;
    spotifyId: string;
  }> = [];

  for (const week of weeks) {
    for (const entry of week.entries) {
      for (const spec of MANUAL_TRACKS) {
        if (!matchesTrack(entry, spec)) continue;
        fixes.push({
          weekDate: week.date,
          position: entry.position,
          artist: entry.artist,
          title: entry.title,
          spotifyId: spec.spotifyId,
        });
      }
    }
  }

  return fixes;
}

async function resolveSong(spotifyId: string, artist: string, title: string) {
  if (DRY_RUN) {
    return { id: `dry-run:${spotifyId}`, spotifyId, albumSpotifyId: null as string | null };
  }

  const metadata = await getSpotifyTrackMetadataById(spotifyId, "US");
  if (!metadata) throw new Error(`Spotify não retornou metadados para ${spotifyId}`);

  const song = await upsertSongFromSpotify(metadata.spotifyId, {
    track: title,
    artist,
    album: metadata.album.title ?? "",
  });

  return {
    id: song.id,
    spotifyId: song.spotifyId,
    albumSpotifyId: song.albumSpotifyId,
  };
}

async function main() {
  const weeks = parseWeeksFromExcel();
  const fixes = collectFixes(weeks);
  console.log(`[info] ${fixes.length} ocorrência(s) a corrigir`);

  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada =
    (await prisma.parada.findFirst({ where: { userId: user.id, name: PARADA_NAME } })) ??
    (await prisma.parada.findFirst({ where: { userId: user.id, isPrimary: true } }));
  if (!parada) throw new Error(`Parada "${PARADA_NAME}" não encontrada.`);

  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const songCache = new Map<string, Awaited<ReturnType<typeof resolveSong>>>();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const fix of fixes) {
    const refDate = parseYmdDate(fix.weekDate);
    const weekIndex = buildWeekIndexFromDate(refDate);
    const label = `${fix.weekDate} #${String(fix.position).padStart(2, "0")} ${fix.artist} - ${fix.title}`;

    const chart = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      include: {
        entries: {
          select: { id: true, position: true, songId: true, song: { select: { title: true, artist: true } } },
        },
      },
    });

    if (!chart) {
      console.log(`[skip] sem chart: ${label}`);
      skipped += 1;
      continue;
    }

    let song = songCache.get(fix.spotifyId);
    if (!song) {
      song = await resolveSong(fix.spotifyId, fix.artist, fix.title);
      songCache.set(fix.spotifyId, song);
    }

    const existingAtPos = chart.entries.find((entry) => entry.position === fix.position);
    const { palette, seed } = paletteFor(fix.artist, fix.title);
    const entryPayload = {
      songId: song.id,
      songSpotifyId: song.spotifyId,
      albumSpotifyId: song.albumSpotifyId,
      points: pointsForChartPosition(fix.position, scoringTier, parada.chartSize, parada.cadence),
      position: fix.position,
      status: "new",
      delta: null,
      prevPos: null,
      peak: fix.position,
      weeks: 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    };

    if (existingAtPos) {
      if (existingAtPos.songId === song.id) {
        console.log(`[ok] já existe: ${label}`);
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry-run] atualizar #${fix.position}: ${existingAtPos.song.artist} - ${existingAtPos.song.title} -> ${fix.artist} - ${fix.title}`);
        updated += 1;
        continue;
      }

      await prisma.chartEntry.update({
        where: { id: existingAtPos.id },
        data: entryPayload,
      });
      console.log(`[update] ${label}`);
      updated += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] inserir: ${label}`);
      inserted += 1;
      continue;
    }

    await prisma.chartEntry.create({
      data: { chartId: chart.id, ...entryPayload },
    });

    const newMaxItems = Math.max(chart.entries.length + 1, fix.position, parada.chartSize ?? 20);
    await prisma.chart.update({
      where: { id: chart.id },
      data: { maxItems: newMaxItems },
    });

    console.log(`[insert] ${label}`);
    inserted += 1;
  }

  if (!DRY_RUN && (inserted > 0 || updated > 0)) {
    const stats = await recomputePersistedChartEntryStatsForParada(prisma, parada.id);
    console.log(`[info] Stats recalculadas: ${stats.charts} charts, ${stats.entries} entradas`);
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Inseridas: ${inserted}`);
  console.log(`Atualizadas: ${updated}`);
  console.log(`Ignoradas: ${skipped}`);
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
