/**
 * Importa a Fifofu Chart (@rafizaka) a partir de um dump de texto no formato crownnote.com.
 *
 * Formato esperado (repetido por semana):
 *   https://www.crownnote.com/charts/rafifofu/fifofu-chart-2026-january-10-...
 *   <posAnterior|NE|RE> <posAtual> <artista> – "<título>" <pico>(×<semanasNoPico>)? <semanasNaParada>
 *   ...
 *   DROPOUTS:
 *   <posAnterior> -- <artista> – "<título>" <pico> <semanas>   ← ignorado
 *
 * Usage:
 *   npx tsx scripts/import-rafizaka-fifofu.ts --dry-run
 *   npx tsx scripts/import-rafizaka-fifofu.ts
 *   npx tsx scripts/import-rafizaka-fifofu.ts --file="C:\path\to\2026rafi.txt"
 *   npx tsx scripts/import-rafizaka-fifofu.ts --skip-spotify
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

const HANDLE = "rafizaka";
const DEFAULT_TXT = "C:\\Users\\blvbr\\Downloads\\2026rafi.txt";
const SPOTIFY_DELAY_MS = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const AUDIT = process.argv.includes("--audit");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const FILE_ARG = process.argv.find((a) => a.startsWith("--file="));
const TXT_PATH = FILE_ARG ? FILE_ARG.split("=").slice(1).join("=") : DEFAULT_TXT;

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Aceita "chart-2026-january-10", "chart-25-january-11" e a URL de 13/09/25 sem "chart" ("the-fifofu-25-september-13").
const URL_DATE_RE = /(?:chart|fifofu)-(\d{2}|\d{4})-([a-z]+)-(\d{1,2})/i;
const DROPOUTS_RE = /^DROPOUTS:?/i;
const ENTRY_LINE_RE = /^(\d+|NE|RE)\s+(\d+)\s+(.+?)\s+[–—-]\s+"([^"]+)"\s+(\d+)(?:\(×\d+\))?\s+(\d+)\s*$/;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArtistForLookup(input: string): string {
  return input.trim().replace(/＝/g, "=").replace(/\s*[,/&]\s*$/g, "").trim();
}

/**
 * Correções manuais para títulos romanizados onde a busca do Spotify (mesmo com mercado JP e
 * variantes de título) retorna a faixa errada ou nenhum resultado — validadas manualmente
 * buscando o título em kanji/nome oficial do artista.
 */
const SPOTIFY_OVERRIDES: Record<string, string> = {
  "junsui to wa nani ka|nogizaka46": "3fMomLqlTRctV8MtNfMocu",
  "anniversary wa iranai|mizuki fukumura": "4W7s4k84f0XdmW6mcj2Lse",
  "shadougawa|nogizaka46": "5ihg6xg9pQUhxyJJwpFEFa",
  "kimi wa 0 kara 1 ni nare|hinatazaka46": "6BQJOpt57lbnGqHIgy2h9N",
  "koishita sakana wa sora wo tobu|hinatazaka46": "4N5HWjDmPbUurPsAfSIrWW",
  "dousousei|angerme": "2sVQ5VJ8Fby4eQNPfp9MEY",
  "jealousy jealousy|morning musume '17": "0hBxKMvJohbJNReVfe8frc",
  "jun'ai crusher|tsubaki factory": "54fNFedKioA012jlvSuQjO",
  "dried fruits|sakurazaka46": "6PVAVpFaqAQDYXTcF1elK3",
  "nagori zakura|akb48": "1Fmz9ddcD55ZBrFdvW9Tuu",
  "mousou dake nara freedom|tsubaki factory": "3t3kQxU4giz0B3T5ccguCj",
};

function findOverrideSpotifyId(title: string, artistRaw: string): string | null {
  const key = `${normalizeText(title.replace(/[?!"']/g, ""))}|${normalizeText(cleanArtistForLookup(artistRaw))}`;
  return SPOTIFY_OVERRIDES[key] ?? null;
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseCrownnoteText(content: string): RawWeek[] {
  const weeks: RawWeek[] = [];
  let current: RawWeek | null = null;
  let inDropouts = false;
  let entryOrder = 0;

  const flushWeek = () => {
    if (current && current.entries.length > 0) weeks.push(current);
    current = null;
    entryOrder = 0;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^https?:\/\//i.test(line)) {
      flushWeek();
      inDropouts = false;
      const dateMatch = line.match(URL_DATE_RE);
      if (!dateMatch) {
        console.warn(`[parse] Não foi possível extrair data da URL: ${line}`);
        continue;
      }
      const yearRaw = Number(dateMatch[1]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const month = MONTH_MAP[dateMatch[2].toLowerCase()];
      const day = Number(dateMatch[3]);
      if (month === undefined) {
        console.warn(`[parse] Mês desconhecido na URL: ${line}`);
        continue;
      }
      current = { date: toYmd(year, month, day), entries: [] };
      continue;
    }

    if (DROPOUTS_RE.test(line)) {
      inDropouts = true;
      continue;
    }

    if (inDropouts || !current) continue;

    const entryMatch = line.match(ENTRY_LINE_RE);
    if (!entryMatch) {
      console.warn(`[parse] Linha ignorada (sem match): ${line}`);
      continue;
    }

    const [, , currRaw, artistRaw, titleRaw] = entryMatch;
    current.entries.push({
      position: Number(currRaw),
      artist: artistRaw.trim(),
      title: titleRaw.trim(),
      order: entryOrder++,
    });
  }

  flushWeek();

  return weeks.sort((a, b) => a.date.localeCompare(b.date));
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada = await prisma.parada.findFirst({
    where: { userId: user.id, cadence: "WEEKLY", isPrimary: true },
  });
  if (!parada) throw new Error(`Nenhuma parada semanal principal encontrada para @${HANDLE}.`);

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

  const first = candidates[0];
  return { id: first.id, spotifyId: first.spotifyId, albumSpotifyId: first.albumSpotifyId };
}

const NON_ORIGINAL_RE =
  /off vocal|instrumental|カラオケ|karaoke|remix|acoustic|live|concert|-\s*ver\.?|from the first take|cover\b/i;

/** Títulos romanizados longos (com partículas japonesas: "wa", "no", "wo"...) confundem a busca
 * do Spotify — prefixos de 2-3 palavras acertam com mais consistência que o título inteiro,
 * então tentamos nessa ordem antes de cair para o título completo ou uma única palavra. */
function titleSearchVariants(title: string): string[] {
  const cleaned = title.replace(/[?!"']/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const variants: string[] = [];
  for (const n of [3, 2, 4, 5, words.length, 1]) {
    if (words.length >= n && n > 0) variants.push(words.slice(0, n).join(" "));
  }
  return [...new Set(variants)];
}

function pickBestSpotifyHit(
  hits: Awaited<ReturnType<typeof searchSpotifyTracks>>,
  artistClean: string,
  claimedThisWeek: Set<string>,
) {
  const artistNorm = normalizeText(artistClean);
  const usable = hits.filter(
    (h) => h.spotifyId && !claimedThisWeek.has(h.spotifyId) && !NON_ORIGINAL_RE.test(h.title),
  );
  if (!usable.length) return null;

  const artistMatch = usable.find((h) => {
    const hArtistNorm = normalizeText(h.artist);
    return hArtistNorm === artistNorm || hArtistNorm.includes(artistNorm) || artistNorm.includes(hArtistNorm);
  });
  return artistMatch ?? usable[0];
}

async function resolveSpotifyId(
  spotifyId: string,
  title: string,
  artistClean: string,
): Promise<ResolvedSong | null> {
  if (DRY_RUN) {
    return { id: `dry-run:${spotifyId}`, spotifyId, albumSpotifyId: null };
  }

  const metadata = await getSpotifyTrackMetadataById(spotifyId, "JP");
  if (!metadata) return null;

  const song = await upsertSongFromSpotify(metadata.spotifyId, {
    track: title,
    artist: artistClean,
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
  const artistForSearch = artistClean.replace(/☆/g, " ").replace(/\s+/g, " ").trim();

  let best: Awaited<ReturnType<typeof searchSpotifyTracks>>[number] | null = null;
  for (const market of ["JP", "US"]) {
    for (const titleVariant of titleSearchVariants(title)) {
      await sleep(SPOTIFY_DELAY_MS);
      const hits = await searchSpotifyTracks(`${titleVariant} ${artistForSearch}`, 6, market);
      best = pickBestSpotifyHit(hits, artistClean, claimedThisWeek);
      if (best) break;
    }
    if (best) break;
  }
  if (!best?.spotifyId) return null;

  return resolveSpotifyId(best.spotifyId, title, artistClean);
}

async function importWeeks() {
  if (!existsSync(TXT_PATH)) throw new Error(`Arquivo não encontrado: ${TXT_PATH}`);

  const weeks = parseCrownnoteText(readFileSync(TXT_PATH, "utf-8"));
  console.log(`[info] Semanas parseadas: ${weeks.length} (${TXT_PATH})`);
  if (!weeks.length) return;

  if (VERBOSE || DRY_RUN) {
    for (const w of weeks) console.log(`  ${w.date}: ${w.entries.length} entradas`);
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
          resolved = await resolveSpotifyId(overrideId, row.title, cleanArtistForLookup(row.artist));
        } else {
          resolved = await resolveSongFromDb(row.title, row.artist);
          if (!resolved && !SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
            resolved = await resolveSongWithSpotify(row.title, row.artist, claimedThisWeek);
          }
        }
        resolverCache.set(cacheKey, resolved);
        if (VERBOSE && !AUDIT) {
          console.log(`[resolve] ${row.artist} - ${row.title} -> ${resolved ? resolved.spotifyId : "NÃO ENCONTRADO"}`);
        }
        if (AUDIT) {
          if (resolved?.spotifyId) {
            const meta = await getSpotifyTrackMetadataById(resolved.spotifyId, "JP");
            console.log(
              `[audit] "${row.artist} - ${row.title}" -> "${meta?.primaryArtist?.name ?? meta?.artists?.[0]?.name ?? "?"} - ${meta?.title ?? "?"}" (${resolved.spotifyId})`,
            );
          } else {
            console.log(`[audit] "${row.artist} - ${row.title}" -> NÃO ENCONTRADO`);
          }
        }
      }

      if (!resolved) {
        notFound.push({ weekDate: week.date, position: row.position, artist: row.artist, title: row.title });
        continue;
      }
      if (resolved.spotifyId) claimedThisWeek.add(resolved.spotifyId);
      resolvedByRow.set(row, resolved);
    }

    const finalRows = sortedEntries.filter((r) => resolvedByRow.has(r));
    if (finalRows.length === 0) {
      console.log(`[warn] ${week.date}: nenhuma música resolvida, pulando.`);
      continue;
    }

    const missingCount = sortedEntries.length - finalRows.length;
    if (missingCount > 0) {
      console.log(`[warn] ${week.date}: ${finalRows.length}/${sortedEntries.length} resolvidas (${missingCount} não encontrada(s))`);
    }

    // peak/weeks/status/delta/prevPos são recalculados no fim via recomputePersistedChartEntryStatsForParada,
    // que encadeia a história real por weekIndex — os valores abaixo são apenas placeholders.
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
      if (VERBOSE) console.log(`[dry-run] ${week.date} -> weekIndex ${weekIndex} (${finalRows.length} entradas)`);
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
    // Recomputa peak/weeks/status/prevPos/delta de TODA a parada (inclui as semanas 202615+
    // já existentes), já que agora elas têm histórico anterior encadeado a partir deste backfill.
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
    console.log("=== NÃO ENCONTRADAS ===");
    const unique = new Map<string, NotFoundRow>();
    for (const miss of notFound) {
      const key = `${normalizeText(miss.title)}|${normalizeText(miss.artist)}`;
      if (!unique.has(key)) unique.set(key, miss);
    }
    for (const miss of unique.values()) console.log(`[miss] ${miss.artist} - ${miss.title}`);
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
