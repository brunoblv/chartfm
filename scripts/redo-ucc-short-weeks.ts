/**
 * Refaz as semanas da parada oficial da comunidade UCC que ficaram com menos
 * músicas do que a planilha (ex.: 20), re-resolvendo as músicas com tratamento
 * correto de featuring entre parênteses — "P!nk (featuring Nate Ruess)" — tanto
 * no artista quanto no título, no banco e no Spotify.
 *
 * Planilha padrão: public/ucc.xlsx (coluna D "Artista - Música", F1+ datas DD.MM).
 *
 * Usage:
 *   npx tsx scripts/redo-ucc-short-weeks.ts --dry-run --verbose
 *   npx tsx scripts/redo-ucc-short-weeks.ts
 *   npx tsx scripts/redo-ucc-short-weeks.ts --xlsx=public/ucc.xlsx --threshold=20
 *   npx tsx scripts/redo-ucc-short-weeks.ts --from=2012-01-01 --until=2013-12-31
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
const DEFAULT_XLSX = join(process.cwd(), "public", "ucc.xlsx");
const PARSE_SCRIPT_PATH = join(process.cwd(), "scripts", "parse-ucc-xlsx.py");
const SPOTIFY_DELAY_MS = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const XLSX_ARG = process.argv.find((a) => a.startsWith("--xlsx="));
const FROM_ARG = process.argv.find((a) => a.startsWith("--from="));
const UNTIL_ARG = process.argv.find((a) => a.startsWith("--until="));
const THRESHOLD_ARG = process.argv.find((a) => a.startsWith("--threshold="));
const PARADA_ARG = process.argv.find((a) => a.startsWith("--parada="));
const XLSX_PATH = XLSX_ARG ? XLSX_ARG.split("=").slice(1).join("=") : DEFAULT_XLSX;
const THRESHOLD = THRESHOLD_ARG ? Number(THRESHOLD_ARG.split("=")[1]) : 20;
const PARADA_ID = PARADA_ARG ? PARADA_ARG.split("=")[1] : null;

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

/**
 * Separa o nome base do(s) artista(s) convidado(s), cobrindo:
 *   "P!nk (featuring Nate Ruess)"  → base "P!nk", feat "Nate Ruess"
 *   "fun. [feat. Janelle Monáe]"   → base "fun.", feat "Janelle Monáe"
 *   "Katy Perry featuring Juicy J" → base "Katy Perry", feat "Juicy J"
 * Funciona tanto para o campo artista quanto para o título.
 */
function parseNameAndFeat(raw: string): { base: string; feat: string | null } {
  let text = raw.trim();
  let feat: string | null = null;

  const paren = text.match(/[([]\s*(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)[)\]]/i);
  if (paren && paren.index != null) {
    feat = paren[1].trim();
    text = (text.slice(0, paren.index) + text.slice(paren.index + paren[0].length))
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    const plain = text.match(/\s+(?:feat\.?|featuring|ft\.?|f\/|w\/|with)\s+(.+)$/i);
    if (plain && plain.index != null) {
      feat = plain[1].trim();
      text = text.slice(0, plain.index).trim();
    }
  }

  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return { base: text || raw.trim(), feat };
}

/** Candidatos de artista para busca: base, convidados (do artista e do título) e combinações. */
function artistCandidates(artistRaw: string, titleRaw: string): string[] {
  const artist = parseNameAndFeat(artistRaw);
  const title = parseNameAndFeat(titleRaw);
  const candidates = [artist.base];
  if (artist.feat) candidates.push(artist.feat, `${artist.base} ${artist.feat}`);
  if (title.feat) candidates.push(title.feat, `${artist.base} ${title.feat}`);
  return [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
}

function buildSearchQueries(artistRaw: string, titleRaw: string): string[] {
  const artist = parseNameAndFeat(artistRaw);
  const title = parseNameAndFeat(titleRaw);
  const feat = artist.feat ?? title.feat;

  const queries = [
    `${title.base} ${artist.base}`,
    `${titleRaw} ${artist.base}`,
  ];
  if (feat) {
    queries.push(
      `${title.base} ${artist.base} ${feat}`,
      `${title.base} ${feat}`,
    );
  }
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function runPythonParser(): string {
  const args = [PARSE_SCRIPT_PATH, XLSX_PATH];
  if (FROM_ARG) args.push(FROM_ARG);
  if (UNTIL_ARG) args.push(UNTIL_ARG);
  const attempts = ["python3", "python"] as const;
  let lastError: unknown;

  for (const bin of attempts) {
    try {
      return execFileSync(bin, args, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
      lastError = err;
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
    }
  }

  const err = lastError as { message?: string; stderr?: string | Buffer; stdout?: string | Buffer };
  const details = [err?.stderr?.toString().trim(), err?.stdout?.toString().trim()]
    .filter(Boolean)
    .join("\n");
  throw new Error(
    `Falha ao executar parse-ucc-xlsx.py.` +
      (details ? `\n${details}` : `\n${err?.message ?? "python3/python não disponível"}`),
  );
}

function parseWeeksFromExcel(): RawWeek[] {
  if (!existsSync(XLSX_PATH)) throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  if (!existsSync(PARSE_SCRIPT_PATH)) throw new Error(`Parser não encontrado: ${PARSE_SCRIPT_PATH}`);
  return JSON.parse(runPythonParser()) as RawWeek[];
}

async function findCommunityUserAndParada() {
  const community = await prisma.community.findUnique({
    where: { slug: COMMUNITY_SLUG },
    select: { id: true, slug: true, name: true, paradaName: true, ownerId: true, maxSongs: true },
  });
  if (!community) throw new Error(`Comunidade "${COMMUNITY_SLUG}" não encontrada.`);
  if (!community.ownerId) throw new Error(`Comunidade "${COMMUNITY_SLUG}" não tem owner definido.`);

  const user = await prisma.user.findUnique({
    where: { id: community.ownerId },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Owner da comunidade não encontrado.`);

  const parada = PARADA_ID
    ? await prisma.parada.findUnique({ where: { id: PARADA_ID } })
    : await prisma.parada.findFirst({
        where: {
          userId: user.id,
          name: { equals: community.paradaName, mode: "insensitive" },
          deletedAt: null,
        },
      });
  if (!parada) {
    throw new Error(
      PARADA_ID
        ? `Parada ${PARADA_ID} não encontrada.`
        : `Parada "${community.paradaName}" não encontrada para @${user.handle}.`,
    );
  }

  console.log(`[info] Comunidade: ${community.name} (${community.slug})`);
  console.log(`[info] Parada: "${parada.name}" (${parada.id}), chartSize=${parada.chartSize}`);
  return { community, user, parada };
}

async function resolveSongFromDb(title: string, artistRaw: string): Promise<ResolvedSong | null> {
  const candidates = artistCandidates(artistRaw, title);
  const { base: baseTitle } = parseNameAndFeat(title);
  const artistFilter = candidates.map((artist) => ({
    artist: { contains: artist.split(" ")[0] ?? artist, mode: "insensitive" as const },
  }));
  const select = {
    id: true,
    spotifyId: true,
    albumSpotifyId: true,
    artist: true,
    title: true,
  } as const;

  // 1) título exato (com e sem o sufixo de featuring da planilha)
  // 2) título base + featuring em OUTRA notação no banco (ex.: planilha
  //    "Umbrella (featuring Jay-Z)" vs banco "Umbrella (feat. JAY-Z)")
  const [exactRows, prefixRows] = await Promise.all([
    prisma.song.findMany({
      where: {
        OR: [...new Set([title, baseTitle])].map((t) => ({
          title: { equals: t, mode: "insensitive" as const },
        })),
        AND: { OR: artistFilter },
      },
      select,
      take: 20,
    }),
    prisma.song.findMany({
      where: {
        title: { startsWith: `${baseTitle} (`, mode: "insensitive" },
        OR: artistFilter,
      },
      select,
      take: 20,
    }),
  ]);

  // No grupo por prefixo, só aceita se o resto do título for parêntese de feat
  const featRest = /^\s*[([]\s*(?:feat\.?|ft\.?|featuring|with|com)\b/i;
  const rows = [
    ...exactRows,
    ...prefixRows.filter((r) => featRest.test(r.title.slice(baseTitle.length))),
  ];

  for (const candidate of candidates) {
    const target = normalizeText(candidate);
    const match =
      rows.find((r) => normalizeText(r.artist) === target) ??
      rows.find((r) => normalizeText(r.artist).startsWith(target)) ??
      rows.find((r) => normalizeText(r.artist).includes(target));
    if (match) {
      return { id: match.id, spotifyId: match.spotifyId, albumSpotifyId: match.albumSpotifyId };
    }
  }
  if (rows.length) {
    const first = rows[0];
    return { id: first.id, spotifyId: first.spotifyId, albumSpotifyId: first.albumSpotifyId };
  }

  return null;
}

function pickBestSpotifyHit(
  hits: Awaited<ReturnType<typeof searchSpotifyTracks>>,
  artistRaw: string,
  titleRaw: string,
  claimedThisWeek: Set<string>,
) {
  const candidates = artistCandidates(artistRaw, titleRaw).map((c) => normalizeText(c));
  const usable = hits.filter((hit) => hit.spotifyId && !claimedThisWeek.has(hit.spotifyId));
  if (!usable.length) return null;

  const artistMatch = usable.find((hit) => {
    const hitNorm = normalizeText(hit.artist);
    return candidates.some(
      (candidate) =>
        hitNorm === candidate || hitNorm.includes(candidate) || candidate.includes(hitNorm),
    );
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
    artist: parseNameAndFeat(artistRaw).base,
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

/** Modo --test="Artista - Título": resolve uma faixa e mostra o resultado. */
async function testResolve(raw: string) {
  const sep = raw.indexOf(" - ");
  if (sep === -1) throw new Error(`--test espera "Artista - Título", recebeu: ${raw}`);
  const artist = raw.slice(0, sep).trim();
  const title = raw.slice(sep + 3).trim();
  console.log(`[test] artista: "${artist}" | título: "${title}"`);
  console.log(`[test] parse artista:`, parseNameAndFeat(artist));
  console.log(`[test] parse título:`, parseNameAndFeat(title));
  console.log(`[test] candidatos de artista:`, artistCandidates(artist, title));
  console.log(`[test] queries Spotify:`, buildSearchQueries(artist, title));

  const fromDb = await resolveSongFromDb(title, artist);
  console.log(`[test] banco:`, fromDb ?? "NÃO ENCONTRADO");
  if (!fromDb && !SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
    const fromSpotify = await resolveSongWithSpotify(title, artist, new Set());
    console.log(`[test] spotify:`, fromSpotify ?? "NÃO ENCONTRADO");
  }
}

async function main() {
  const testArg = process.argv.find((a) => a.startsWith("--test="));
  if (testArg) {
    await testResolve(testArg.split("=").slice(1).join("="));
    return;
  }

  console.log(`[info] Planilha: ${XLSX_PATH}`);
  console.log(`[info] Threshold: semanas com menos de ${THRESHOLD} músicas serão refeitas`);
  const weeks = parseWeeksFromExcel();
  console.log(`[info] Semanas na planilha: ${weeks.length}`);
  if (!weeks.length) return;

  const { community, user, parada } = await findCommunityUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const chartSize = parada.chartSize ?? 20;

  if (!SKIP_SPOTIFY && !process.env.SPOTIFY_CLIENT_ID) {
    console.warn("[warn] SPOTIFY_CLIENT_ID ausente — só busca no banco.");
  }

  // Charts existentes da parada, com contagem de entradas
  const existingCharts = await prisma.chart.findMany({
    where: { paradaId: parada.id },
    select: { id: true, weekIndex: true, _count: { select: { entries: true } } },
  });
  const chartByWeekIndex = new Map(existingCharts.map((c) => [c.weekIndex, c]));

  // Seleciona semanas a refazer: chart inexistente ou com menos entradas que
  // min(threshold, entradas na planilha)
  const toRedo: { week: RawWeek; weekIndex: number; currentCount: number }[] = [];
  for (const week of weeks) {
    const weekIndex = buildWeekIndexFromDate(parseYmdDate(week.date));
    const existing = chartByWeekIndex.get(weekIndex);
    const expected = Math.min(THRESHOLD, week.entries.length);
    const currentCount = existing?._count.entries ?? 0;
    if (currentCount < expected) {
      toRedo.push({ week, weekIndex, currentCount });
    }
  }

  console.log(`[info] Semanas a refazer: ${toRedo.length}`);
  for (const item of toRedo) {
    console.log(
      `  ${item.week.date} (weekIndex ${item.weekIndex}): ${item.currentCount} no banco vs ${item.week.entries.length} na planilha`,
    );
  }
  if (!toRedo.length) {
    console.log("[ok] Nenhuma semana incompleta. Nada a fazer.");
    return;
  }

  const notFound: NotFoundRow[] = [];
  const resolverCache = new Map<string, ResolvedSong | null>();
  let redoneCharts = 0;
  let createdEntries = 0;

  for (let i = 0; i < toRedo.length; i++) {
    const { week, weekIndex } = toRedo[i];
    console.log(
      `[info] Semana ${i + 1}/${toRedo.length}: ${week.date} (${week.entries.length} entradas)`,
    );
    const refDate = parseYmdDate(week.date);
    const weekLabel = buildWeekLabelFromDate(refDate);
    const dateRange = buildDateRangeFromDate(refDate);
    const { start: weekStart } = getChartWeekRange(refDate);

    const sortedEntries = [...week.entries].sort((a, b) => a.position - b.position);
    const resolvedByRow = new Map<RawEntry, ResolvedSong>();
    const claimedThisWeek = new Set<string>();

    for (const row of sortedEntries) {
      const cacheKey = `${normalizeText(row.title)}|${normalizeText(parseNameAndFeat(row.artist).base)}`;
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

    if (DRY_RUN) {
      console.log(`[dry-run] ${week.date} -> ${finalRows.length} entradas seriam gravadas`);
      continue;
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

    const chartPayload = {
      weekLabel,
      dateRange,
      publishedAt: refDate,
      weekStartDate: weekStart,
      maxItems: finalRows.length,
      communityId: community.id,
      entries: { create: entryPayload },
    };

    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      select: { id: true },
    });

    if (!existing) {
      await prisma.chart.create({
        data: { userId: user.id, paradaId: parada.id, weekIndex, ...chartPayload },
      });
    } else {
      await prisma.$transaction([
        prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
        prisma.chart.update({ where: { id: existing.id }, data: chartPayload }),
      ]);
    }

    redoneCharts += 1;
    createdEntries += finalRows.length;
    console.log(`[ok] ${week.date} -> weekIndex ${weekIndex} (${finalRows.length} entradas)`);
  }

  if (!DRY_RUN && redoneCharts > 0) {
    const stats = await recomputePersistedChartEntryStatsForParada(prisma, parada.id);
    console.log(`[info] Stats recalculadas: ${stats.charts} charts, ${stats.entries} entradas`);
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Semanas refeitas: ${redoneCharts}`);
  console.log(`Entradas gravadas: ${createdEntries}`);
  console.log(`Não encontradas (BD + Spotify): ${notFound.length}`);

  if (notFound.length) {
    console.log("");
    console.log("=== NÃO ENCONTRADAS (dia | posição | música) ===");
    const sorted = [...notFound].sort(
      (a, b) => a.weekDate.localeCompare(b.weekDate) || a.position - b.position,
    );
    for (const miss of sorted) {
      console.log(`[miss] ${miss.weekDate} | #${miss.position} | ${miss.artist} - ${miss.title}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
