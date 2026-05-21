/**
 * Importa as paradas TBHP (The Best Hit Parade) do usuário boofrnds.
 *
 * Formato do arquivo:
 *   [ DD/MM/YYYY - DD/MM/YYYY ]
 *   #01) Artista, "Título" [Nth week/delta/Peak: X]
 *   (( FALL OFFS )) — tudo após essa linha é ignorado até o próximo header
 *
 * Uso (na raiz do projeto):
 *   npx tsx scripts/import-boofrnds-tbhp.ts --dry-run
 *   npx tsx scripts/import-boofrnds-tbhp.ts
 *   npx tsx scripts/import-boofrnds-tbhp.ts --years=2017,2018,2026
 *   npx tsx scripts/import-boofrnds-tbhp.ts --file="public/boofrnds/TBHP2026.txt"
 *   npx tsx scripts/import-boofrnds-tbhp.ts --delay-ms=500 --market=US
 *   npx tsx scripts/import-boofrnds-tbhp.ts --skip-weeks=5
 *
 * O script pula semanas já existentes no banco — seguro re-rodar.
 * Requer .env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  buildDateRangeFromDate,
  prevChartWeekIndex,
  getChartWeekRange,
} from "../lib/chart-week";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import {
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
  spotifyConfigured,
} from "../lib/spotify-server";

const USER_HANDLE = "boofrnds";
const DEFAULT_DIR = path.join(process.cwd(), "public", "boofrnds");
const DEFAULT_YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i); // 2017-2026

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#4ECDC4", "#556270"],
  ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"],
  ["#A8E6CF", "#3D5A80"],
  ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"],
  ["#1B2021", "#FFD166"],
  ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"],
  ["#8338EC", "#FB5607"],
];

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function paletteFor(artist: string, title: string): { palette: [string, string]; seed: number } {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

/**
 * Parseia o header de data: [ 10/01/2026 - 16/01/2026 ]
 * Retorna a data de início (Sunday) que representa a semana.
 */
function parseDateHeader(line: string): Date | null {
  const m = line.match(/\[\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s*\]/);
  if (!m) return null;
  const [, sd, sm, sy] = m;
  return new Date(parseInt(sy, 10), parseInt(sm, 10) - 1, parseInt(sd, 10));
}

type ParsedEntry = { position: number; artist: string; title: string };
type WeekBlock = { date: Date; dateEnd: Date; entries: ParsedEntry[] };

// Entry line: #01) Artist, "Title" [stats]
// Artist can contain commas (e.g. "Danny L Harle f/ Oklou; MNEK") so we use greedy match
// and look for the last `, "` before the title.
const ENTRY_RE = /^#(\d+)\)\s+(.+),\s+"([^"]+)"/;

function parseFile(raw: string): WeekBlock[] {
  const blocks: WeekBlock[] = [];
  let inFallOffs = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Date header — starts a new week block
    const headerDate = parseDateHeader(line);
    if (headerDate) {
      // Compute end date: start + 6 days
      const endDate = new Date(headerDate);
      endDate.setDate(endDate.getDate() + 6);
      blocks.push({ date: headerDate, dateEnd: endDate, entries: [] });
      inFallOffs = false;
      continue;
    }

    if (blocks.length === 0) continue;

    // Fall offs marker — ignore everything until the next date header
    if (/^\(\(\s*FALL\s*OFFS\s*\)\)/i.test(line)) {
      inFallOffs = true;
      continue;
    }
    if (inFallOffs) continue;

    const m = line.match(ENTRY_RE);
    if (!m) continue;
    const position = parseInt(m[1], 10);
    if (!Number.isFinite(position)) continue;
    blocks[blocks.length - 1].entries.push({
      position,
      artist: m[2].trim(),
      title: m[3].trim(),
    });
  }

  return blocks.filter((b) => b.entries.length > 0);
}

async function findSongInDb(artist: string, title: string) {
  return prisma.song.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      artist: { equals: artist, mode: "insensitive" },
    },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
}

/** Spotify search query: strip featuring artists for better match rate. */
function buildSearchQuery(artist: string, title: string): string {
  const mainArtist = artist.split(/\s+f\/\s+/i)[0].trim();
  return `${mainArtist} ${title}`;
}

async function ensureSong(
  artist: string,
  title: string,
  market: string,
  delayMs: number,
): Promise<{ id: string; spotifyId: string | null; albumSpotifyId: string | null }> {
  const existing = await findSongInDb(artist, title);
  if (existing?.spotifyId) return existing;

  await sleep(delayMs);
  let hits: { spotifyId: string }[] = [];
  try { hits = await searchSpotifyTracks(buildSearchQuery(artist, title), 10, market); }
  catch (e) { console.warn(`  spotify_search_error: ${e}`); }

  if (existing) {
    // Song in DB without Spotify — try to enrich
    if (hits.length) {
      try {
        await sleep(delayMs);
        const meta = await getSpotifyTrackMetadataById(hits[0].spotifyId, market);
        if (meta) {
          const res = await applySpotifyMetadataToSong(existing.id, meta, false);
          if (!res.ok && res.reason.startsWith("spotify_id_conflict:")) {
            const otherId = res.reason.split(":")[1];
            await prisma.song.delete({ where: { id: existing.id } }).catch(() => {});
            const other = await prisma.song.findUnique({
              where: { id: otherId },
              select: { id: true, spotifyId: true, albumSpotifyId: true },
            });
            if (other) return other;
          }
        }
      } catch (e) { console.warn(`  spotify_enrich_error: ${e}`); }
    }
    const refreshed = await prisma.song.findUnique({
      where: { id: existing.id },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    return refreshed ?? existing;
  }

  // New song — fetch Spotify metadata before creating
  let spotifyMeta = null;
  if (hits.length) {
    try {
      await sleep(delayMs);
      spotifyMeta = await getSpotifyTrackMetadataById(hits[0].spotifyId, market);
    } catch (e) { console.warn(`  spotify_meta_error: ${e}`); }
  }

  if (!spotifyMeta?.primaryArtist) {
    console.warn(`  NO_SPOTIFY creating bare: "${title}" — ${artist}`);
  }

  const created = await prisma.song.create({
    data: { title, artist, album: null },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });

  if (spotifyMeta?.primaryArtist) {
    const res = await applySpotifyMetadataToSong(created.id, spotifyMeta, false);
    if (!res.ok && res.reason.startsWith("spotify_id_conflict:")) {
      const otherId = res.reason.split(":")[1];
      await prisma.song.delete({ where: { id: created.id } }).catch(() => {});
      const other = await prisma.song.findUnique({
        where: { id: otherId },
        select: { id: true, spotifyId: true, albumSpotifyId: true },
      });
      if (other) return other;
    } else if (res.ok) {
      const updated = await prisma.song.findUnique({
        where: { id: created.id },
        select: { id: true, spotifyId: true, albumSpotifyId: true },
      });
      return updated ?? created;
    }
  }

  return created;
}

/**
 * Localiza e carrega arquivos TBHP para os anos especificados.
 * Retorna um array de { year, filePath, blocks } ou null se não encontrado.
 */
function loadTbhpFiles(dir: string, years: number[]): Array<{ year: number; filePath: string; blocks: WeekBlock[] }> {
  const results: Array<{ year: number; filePath: string; blocks: WeekBlock[] }> = [];

  // Se --file foi passado, usar um arquivo específico
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (fileArg) {
    const rawPath = fileArg.slice("--file=".length).trim();
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    if (!existsSync(absPath)) {
      console.error("Arquivo não encontrado:", absPath);
      process.exit(1);
    }
    const raw = readFileSync(absPath, "utf8");
    const blocks = parseFile(raw);
    const year = parseInt(path.basename(absPath).match(/\d{4}/)?.[0] ?? "2026", 10);
    results.push({ year, filePath: absPath, blocks });
    return results;
  }

  // Caso contrário, procurar por arquivos TBHPYYYY.txt no diretório
  if (!existsSync(dir)) {
    console.warn(`Diretório não encontrado: ${dir}`);
    return results;
  }

  const files = readdirSync(dir);
  const yearsSet = new Set(years);

  for (const file of files) {
    const yearMatch = file.match(/TBHP(\d{4})\.txt$/i);
    if (!yearMatch) continue;

    const year = parseInt(yearMatch[1], 10);
    if (!yearsSet.has(year)) continue;

    const filePath = path.join(dir, file);
    try {
      const raw = readFileSync(filePath, "utf8");
      const blocks = parseFile(raw);
      if (blocks.length > 0) {
        results.push({ year, filePath, blocks });
      }
    } catch (e) {
      console.warn(`Erro ao ler ${file}: ${e}`);
    }
  }

  // Ordenar por year
  results.sort((a, b) => a.year - b.year);

  return results;
}

async function main() {
  loadEnvFile();

  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const yearsArg = argv.find((a) => a.startsWith("--years="));
  const delayArg = argv.find((a) => a.startsWith("--delay-ms="));
  const marketArg = argv.find((a) => a.startsWith("--market="));
  const skipArg = argv.find((a) => a.startsWith("--skip-weeks="));

  const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split("=")[1] ?? "400", 10) || 400) : 400;
  const market = (marketArg?.split("=")[1] ?? "US").trim() || "US";
  const skipWeeks = skipArg ? Math.max(0, parseInt(skipArg.split("=")[1] ?? "0", 10)) : 0;

  const years = yearsArg
    ? yearsArg
        .slice("--years=".length)
        .split(",")
        .map((y) => parseInt(y.trim(), 10))
        .filter((y) => Number.isFinite(y))
    : DEFAULT_YEARS;

  if (!spotifyConfigured()) {
    console.error("ERRO: Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const tbhpFiles = loadTbhpFiles(DEFAULT_DIR, years);

  if (tbhpFiles.length === 0) {
    console.error("Nenhum arquivo TBHP encontrado para os anos especificados");
    process.exit(1);
  }

  console.log(`Arquivos encontrados: ${tbhpFiles.length}`);
  for (const { year, filePath, blocks } of tbhpFiles) {
    console.log(`  [${year}] ${path.basename(filePath)} — ${blocks.length} semanas`);
  }
  console.log(`\nModo: ${dryRun ? "DRY RUN" : "PRODUÇÃO"} | delay=${delayMs}ms | market=${market}\n`);

  const user = await prisma.user.findFirst({
    where: { handle: { equals: USER_HANDLE, mode: "insensitive" } },
    select: { id: true, handle: true },
  });
  if (!user) {
    console.error("Usuário não encontrado:", USER_HANDLE);
    process.exit(1);
  }
  console.log(`Usuário: @${user.handle} (${user.id})\n`);

  // Pre-load existing week indexes for this user
  const existingRaw = await prisma.chart.findMany({
    where: { userId: user.id },
    select: { weekIndex: true },
  });
  const existingIndexes = new Set(existingRaw.map((c) => c.weekIndex));
  console.log(`Charts já no banco: ${existingIndexes.size}\n`);

  let chartCreated = 0;
  let chartSkipped = 0;
  let totalSongsFailed = 0;
  let totalFilesProcessed = 0;

  for (const { year, blocks } of tbhpFiles) {
    console.log(`\n========== PROCESSANDO ANO ${year} ==========\n`);

    const toProcess = blocks.slice(skipWeeks);

    for (let wi = 0; wi < toProcess.length; wi++) {
      const block = toProcess[wi];
      const weekIndex = buildWeekIndexFromDate(block.date);
      const weekLabel = buildWeekLabelFromDate(block.date);
      const dateRange = buildDateRangeFromDate(block.date);
      const { end: weekEnd } = getChartWeekRange(block.date);
      const globalIdx = wi + 1 + skipWeeks;

      if (existingIndexes.has(weekIndex)) {
        chartSkipped++;
        console.log(`SKIP [${year}/${globalIdx}/${blocks.length}] ${weekIndex} já existe`);
        continue;
      }

      console.log(`\n[${year}/${globalIdx}/${blocks.length}] ${weekIndex} | ${block.date.toISOString().slice(0, 10)} | ${block.entries.length} músicas`);

      if (dryRun) {
        for (const e of block.entries) {
          const inDb = await findSongInDb(e.artist, e.title);
          console.log(`  DRY #${String(e.position).padStart(3)} "${e.title}" — ${e.artist} | base: ${inDb ? "sim" + (inDb.spotifyId ? " (Spotify)" : "") : "não"}`);
        }
        chartCreated++;
        continue;
      }

      // Load previous week's chart for peak/weeks calculation
      const prevIdx = prevChartWeekIndex(weekIndex);
      const prevChart = await prisma.chart.findFirst({
        where: { userId: user.id, weekIndex: prevIdx },
        select: { entries: { select: { songId: true, position: true, peak: true, weeks: true } } },
      });
      const prevBySongId = new Map(prevChart?.entries.map((e) => [e.songId, e]) ?? []);

      // Create chart
      const chart = await prisma.chart.create({
        data: {
          userId: user.id,
          weekIndex,
          weekLabel,
          dateRange,
          publishedAt: weekEnd,
          weekStartDate: block.date,
          isPublished: true,
          maxItems: block.entries.length,
        },
        select: { id: true },
      });
      existingIndexes.add(weekIndex);

      let okCount = 0;
      let failCount = 0;

      for (const e of block.entries) {
        const { palette, seed } = paletteFor(e.artist, e.title);

        let songRow: { id: string; spotifyId: string | null; albumSpotifyId: string | null };
        try {
          songRow = await ensureSong(e.artist, e.title, market, delayMs);
        } catch (err) {
          console.error(`  SONG_ERR pos ${e.position} "${e.title}" — ${e.artist}: ${err}`);
          failCount++;
          totalSongsFailed++;
          continue;
        }

        const prevEntry = prevBySongId.get(songRow.id);
        let status: string;
        let delta: number | null;
        let prevPos: number | null;
        let peak: number;
        let weeks: number;

        if (prevEntry) {
          delta = prevEntry.position - e.position;
          prevPos = prevEntry.position;
          status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
          peak = Math.min(e.position, prevEntry.peak);
          weeks = prevEntry.weeks + 1;
        } else {
          status = "new";
          delta = null;
          prevPos = null;
          peak = e.position;
          weeks = 1;
        }

        await prisma.chartEntry.create({
          data: {
            chartId: chart.id,
            songId: songRow.id,
            position: e.position,
            points: 101 - e.position,
            songSpotifyId: songRow.spotifyId,
            albumSpotifyId: songRow.albumSpotifyId,
            status,
            delta,
            prevPos,
            peak,
            weeks,
            coverPaletteA: palette[0],
            coverPaletteB: palette[1],
            coverSeed: seed,
          },
        });
        okCount++;
        console.log(`  OK #${String(e.position).padStart(3)} "${e.title}" — ${e.artist}`);
      }

      chartCreated++;
      if (failCount > 0) {
        console.log(`  → chart ${chart.id}: ok=${okCount}, FAIL=${failCount}`);
      }
    }

    totalFilesProcessed++;
  }

  console.log(`\n=== FIM ===`);
  console.log(`arquivos_processados=${totalFilesProcessed}`);
  console.log(`charts_criados=${chartCreated}`);
  console.log(`charts_pulados=${chartSkipped}`);
  console.log(`songs_failed_total=${totalSongsFailed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());