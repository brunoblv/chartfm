/**
 * Importa o histórico completo GLC (GL Countdown) do arquivo Historic - GLC.txt.
 *
 * Formato do arquivo: blocos separados por URL do Crownnote, cada bloco tem
 * linhas no formato:  prevPos curr Artista – "Título" [peak [weeks]]
 * prevPos pode ser NE (novo), RE (re-entrada) ou número.
 *
 * Uso (na raiz do projeto):
 *   npx tsx scripts/import-glc-historic.ts --dry-run
 *   npx tsx scripts/import-glc-historic.ts
 *   npx tsx scripts/import-glc-historic.ts --file="C:/path/to/Historic - GLC.txt"
 *   npx tsx scripts/import-glc-historic.ts --delay-ms=500 --market=US
 *   npx tsx scripts/import-glc-historic.ts --skip-weeks=50
 *
 * O script pula automaticamente semanas já existentes no banco — é seguro re-rodar.
 * Requer .env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 */

import { existsSync, readFileSync } from "node:fs";
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

const USER_HANDLE = "briry";
const DEFAULT_FILE = path.join(process.cwd(), "public", "Brian", "Historic - GLC.txt");

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

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

function normalizeLine(s: string): string {
  return s
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ");
}

/** glcountdown-nov-11-2007 → new Date(2007, 10, 11) */
function parseDateFromSlug(slug: string): Date | null {
  const m = slug.match(/glcountdown-([a-z]{3})-(\d{1,2})-(\d{4})$/i);
  if (!m) return null;
  const month = MONTH_MAP[m[1].toLowerCase()];
  if (month === undefined) return null;
  return new Date(parseInt(m[3], 10), month, parseInt(m[2], 10));
}

type ParsedEntry = { prevRaw: string; curr: number; artist: string; title: string };
type WeekBlock = { url: string; date: Date; entries: ParsedEntry[] };

// Entry line: prevPos(NE/RE/number) curr Artist – "Title" [optional trailing]
// DROPOUT lines (e.g. "8 -- Artist – "Title"") are excluded because "--" won't match \d+
const ENTRY_RE = /^(\d+|NE|RE)\s+(\d+)\s+(.+?)\s+[-–]\s*"([^"]+)"/i;

function parseFile(raw: string): WeekBlock[] {
  const blocks: WeekBlock[] = [];
  let inDropouts = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = normalizeLine(rawLine.trim());
    if (!line) continue;

    if (/^https?:\/\//i.test(line)) {
      const urlParts = line.split("/");
      const slug = (urlParts[urlParts.length - 1] ?? "").split("?")[0];
      const date = parseDateFromSlug(slug);
      if (date) {
        blocks.push({ url: line, date, entries: [] });
        inDropouts = false;
      }
      continue;
    }

    if (blocks.length === 0) continue;
    if (/^DROPOUTS/i.test(line)) { inDropouts = true; continue; }
    if (inDropouts) continue;

    const m = line.match(ENTRY_RE);
    if (!m) continue;
    const curr = parseInt(m[2], 10);
    if (!Number.isFinite(curr)) continue;
    blocks[blocks.length - 1].entries.push({
      prevRaw: m[1].toUpperCase(),
      curr,
      artist: m[3].trim(),
      title: m[4].trim(),
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

async function ensureSong(
  artist: string,
  title: string,
  market: string,
  delayMs: number,
): Promise<{ id: string; spotifyId: string | null; albumSpotifyId: string | null }> {
  const existing = await findSongInDb(artist, title);
  if (existing?.spotifyId) return existing;

  // Search Spotify
  await sleep(delayMs);
  let hits: { spotifyId: string }[] = [];
  try { hits = await searchSpotifyTracks(`${artist} ${title}`, 10, market); }
  catch (e) { console.warn(`  spotify_search_error: ${e}`); }

  if (existing) {
    // Song in DB but no Spotify — try to enrich
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

async function main() {
  loadEnvFile();

  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const delayArg = argv.find((a) => a.startsWith("--delay-ms="));
  const marketArg = argv.find((a) => a.startsWith("--market="));
  const skipArg = argv.find((a) => a.startsWith("--skip-weeks="));

  const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split("=")[1] ?? "400", 10) || 400) : 400;
  const market = (marketArg?.split("=")[1] ?? "US").trim() || "US";
  const skipWeeks = skipArg ? Math.max(0, parseInt(skipArg.split("=")[1] ?? "0", 10)) : 0;

  if (!spotifyConfigured()) {
    console.error("ERRO: Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const rawPath = fileArg ? fileArg.slice("--file=".length).trim() : DEFAULT_FILE;
  const absPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  if (!existsSync(absPath)) {
    console.error("Arquivo não encontrado:", absPath);
    process.exit(1);
  }

  const raw = readFileSync(absPath, "utf8");
  const blocks = parseFile(raw);
  console.log(`Semanas no arquivo: ${blocks.length}`);
  if (blocks.length > 0) {
    console.log(`  Primeira: ${blocks[0].date.toISOString().slice(0, 10)} (${blocks[0].url})`);
    console.log(`  Última:   ${blocks[blocks.length - 1].date.toISOString().slice(0, 10)}`);
  }
  if (skipWeeks > 0) console.log(`Pulando primeiras ${skipWeeks} semanas`);
  console.log(`Modo: ${dryRun ? "DRY RUN" : "PRODUÇÃO"} | delay=${delayMs}ms | market=${market}\n`);

  const user = await prisma.user.findFirst({
    where: { handle: { equals: USER_HANDLE, mode: "insensitive" } },
    select: { id: true, handle: true },
  });
  if (!user) {
    console.error("Usuário não encontrado:", USER_HANDLE);
    process.exit(1);
  }
  console.log(`Usuário: @${user.handle} (${user.id})\n`);

  // Load existing week indexes for this user (skip already-imported weeks)
  const existingRaw = await prisma.chart.findMany({
    where: { userId: user.id },
    select: { weekIndex: true },
  });
  const existingIndexes = new Set(existingRaw.map((c) => c.weekIndex));
  console.log(`Charts já no banco: ${existingIndexes.size}\n`);

  let chartCreated = 0;
  let chartSkipped = 0;
  let totalSongsFailed = 0;

  const toProcess = blocks.slice(skipWeeks);

  for (let wi = 0; wi < toProcess.length; wi++) {
    const block = toProcess[wi];
    const weekIndex = buildWeekIndexFromDate(block.date);
    const weekLabel = buildWeekLabelFromDate(block.date);
    const dateRange = buildDateRangeFromDate(block.date);
    const { start: weekStart, end: weekEnd } = getChartWeekRange(block.date);
    const globalIdx = wi + 1 + skipWeeks;

    if (existingIndexes.has(weekIndex)) {
      chartSkipped++;
      console.log(`SKIP [${globalIdx}/${blocks.length}] ${weekIndex} já existe`);
      continue;
    }

    console.log(`\n[${globalIdx}/${blocks.length}] ${weekIndex} | ${block.date.toISOString().slice(0, 10)} | ${block.entries.length} músicas`);

    if (dryRun) {
      for (const e of block.entries) {
        const inDb = await findSongInDb(e.artist, e.title);
        console.log(`  DRY ${e.curr} "${e.title}" — ${e.artist} | base: ${inDb ? "sim" + (inDb.spotifyId ? " (Spotify)" : "") : "não"}`);
      }
      chartCreated++;
      continue;
    }

    // Load prev week's chart to compute peak/weeks from history
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
        weekStartDate: weekStart,
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
        console.error(`  SONG_ERR pos ${e.curr} "${e.title}" — ${e.artist}: ${err}`);
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
        delta = prevEntry.position - e.curr;
        prevPos = prevEntry.position;
        status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
        peak = Math.min(e.curr, prevEntry.peak);
        weeks = prevEntry.weeks + 1;
      } else {
        status = "new";
        delta = null;
        prevPos = null;
        peak = e.curr;
        weeks = 1;
      }

      await prisma.chartEntry.create({
        data: {
          chartId: chart.id,
          songId: songRow.id,
          position: e.curr,
          points: 101 - e.curr,
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
      console.log(`  OK ${e.curr} "${e.title}" — ${e.artist}`);
    }

    chartCreated++;
    if (failCount > 0) {
      console.log(`  → chart ${chart.id}: ok=${okCount}, FAIL=${failCount}`);
    }
  }

  console.log(`\n=== FIM ===`);
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
