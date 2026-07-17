/**
 * Importa a Personal Chart do @otiagoqz a partir do JSON Crownnote já mapeado
 * (songMappings com songId/spotifyId).
 *
 * Fonte padrão:
 *   C:\Users\d854440\Downloads\crownnote-heytiago-mapped-2026-07-17.json
 *
 * Usage:
 *   npx tsx scripts/import-otiagoqz-crownnote.ts --dry-run
 *   npx tsx scripts/import-otiagoqz-crownnote.ts --dry-run --verbose
 *   npx tsx scripts/import-otiagoqz-crownnote.ts
 *   npx tsx scripts/import-otiagoqz-crownnote.ts --file="C:\path\to\mapped.json"
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { resolveCrownnoteChartDate } from "../lib/crownnote-export";
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
import {
  crownnoteSongKey,
  type CrownnoteMappedExport,
  type CrownnoteSongMapping,
} from "../lib/crownnote-song-match";

type ResolvedSong = { id: string; spotifyId: string | null; albumSpotifyId: string | null };
type RawWeek = {
  date: string;
  slug: string;
  entries: Array<{ position: number; artist: string; title: string }>;
};
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

const HANDLE = "otiagoqz";
const DEFAULT_JSON =
  "C:\\Users\\d854440\\Downloads\\crownnote-heytiago-mapped-2026-07-17.json";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const FILE_ARG = process.argv.find((a) => a.startsWith("--file="));
const JSON_PATH = FILE_ARG ? FILE_ARG.split("=").slice(1).join("=") : DEFAULT_JSON;

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function loadMappedExport(path: string): CrownnoteMappedExport {
  if (!existsSync(path)) throw new Error(`Arquivo não encontrado: ${path}`);
  const data = JSON.parse(readFileSync(path, "utf-8")) as CrownnoteMappedExport;
  if (data.source !== "crownnote") {
    throw new Error(`JSON inválido: source esperado "crownnote", veio "${String(data.source)}".`);
  }
  if (!Array.isArray(data.charts) || !Array.isArray(data.songMappings)) {
    throw new Error("JSON inválido: faltam charts ou songMappings.");
  }
  return data;
}

function buildWeeks(data: CrownnoteMappedExport): RawWeek[] {
  const weeks: RawWeek[] = [];
  let previousDate: string | null = null;

  for (const chart of data.charts) {
    const date = resolveCrownnoteChartDate(chart.slug, chart.date, previousDate);
    if (!date) {
      throw new Error(`Não foi possível extrair data do slug: ${chart.slug}`);
    }

    const entries = [...chart.entries]
      .map((e) => ({
        position: e.position,
        artist: e.artist,
        title: e.title,
      }))
      .sort((a, b) => a.position - b.position);

    if (!entries.length) {
      console.warn(`[warn] Chart sem entradas, pulando: ${chart.slug}`);
      continue;
    }

    weeks.push({ date, slug: chart.slug, entries });
    previousDate = date;
  }

  return weeks.sort((a, b) => a.date.localeCompare(b.date));
}

async function findUserAndParada() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true, name: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const parada = await prisma.parada.findFirst({
    where: { userId: user.id, cadence: "WEEKLY", deletedAt: null, isPrimary: true },
    orderBy: [{ sortOrder: "asc" }],
  });
  if (!parada) {
    throw new Error(`Nenhuma parada semanal principal encontrada para @${HANDLE}.`);
  }

  console.log(`[info] Usuário: @${user.handle} (${user.name ?? "—"})`);
  console.log(
    `[info] Parada: "${parada.name}" (${parada.id}) chartSize=${parada.chartSize ?? "null"}`,
  );
  return { user, parada };
}

async function resolveMappedSong(
  mapping: CrownnoteSongMapping | undefined,
  artist: string,
  title: string,
  cache: Map<string, ResolvedSong | null>,
): Promise<ResolvedSong | null> {
  const key = crownnoteSongKey(artist, title);
  if (cache.has(key)) return cache.get(key) ?? null;

  let resolved: ResolvedSong | null = null;

  if (mapping?.songId) {
    const byId = await prisma.song.findUnique({
      where: { id: mapping.songId },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    if (byId) {
      resolved = {
        id: byId.id,
        spotifyId: byId.spotifyId ?? mapping.spotifyId,
        albumSpotifyId: byId.albumSpotifyId ?? mapping.albumSpotifyId,
      };
    }
  }

  if (!resolved && mapping?.spotifyId) {
    const bySpotify = await prisma.song.findUnique({
      where: { spotifyId: mapping.spotifyId },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    if (bySpotify) {
      resolved = {
        id: bySpotify.id,
        spotifyId: bySpotify.spotifyId,
        albumSpotifyId: bySpotify.albumSpotifyId ?? mapping.albumSpotifyId,
      };
    } else if (!DRY_RUN) {
      const upserted = await upsertSongFromSpotify(mapping.spotifyId, {
        track: mapping.title || title,
        artist: mapping.artist || artist,
      });
      resolved = {
        id: upserted.id,
        spotifyId: upserted.spotifyId,
        albumSpotifyId: upserted.albumSpotifyId,
      };
    } else {
      resolved = {
        id: `dry-run:${mapping.spotifyId}`,
        spotifyId: mapping.spotifyId,
        albumSpotifyId: mapping.albumSpotifyId,
      };
    }
  }

  cache.set(key, resolved);
  return resolved;
}

async function importWeeks() {
  const data = loadMappedExport(JSON_PATH);
  console.log("=== Import Crownnote → @otiagoqz ===");
  console.log(`[info] Arquivo: ${JSON_PATH}`);
  console.log(`[info] Crownnote user: ${data.username}`);
  console.log(
    `[info] Mappings: ${data.songMappings.length} (matched ${data.matchStats?.matched ?? "?"}/${data.matchStats?.uniqueSongs ?? "?"})`,
  );
  if (DRY_RUN) console.log("[info] Modo: dry-run");

  const weeks = buildWeeks(data);
  console.log(`[info] Semanas: ${weeks.length} (${weeks[0]?.date} → ${weeks.at(-1)?.date})`);

  const mappingByKey = new Map(data.songMappings.map((m) => [m.key, m]));
  const { user, parada } = await findUserAndParada();
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);

  const songCache = new Map<string, ResolvedSong | null>();
  const notFound: NotFoundRow[] = [];
  let createdCharts = 0;
  let updatedCharts = 0;
  let createdEntries = 0;

  // Detecta weekIndex duplicado (duas datas caem na mesma semana ISO)
  const weekIndexSeen = new Map<number, string>();

  for (const week of weeks) {
    const refDate = parseYmdDate(week.date);
    const weekIndex = buildWeekIndexFromDate(refDate);
    const weekLabel = buildWeekLabelFromDate(refDate);
    const dateRange = buildDateRangeFromDate(refDate);
    const { start: weekStart } = getChartWeekRange(refDate);

    const prevSlug = weekIndexSeen.get(weekIndex);
    if (prevSlug) {
      throw new Error(
        `weekIndex ${weekIndex} colide: ${prevSlug} e ${week.slug} (${week.date}).`,
      );
    }
    weekIndexSeen.set(weekIndex, week.slug);

    const resolvedByPos = new Map<number, ResolvedSong>();

    for (const row of week.entries) {
      const key = crownnoteSongKey(row.artist, row.title);
      const mapping = mappingByKey.get(key);
      const resolved = await resolveMappedSong(mapping, row.artist, row.title, songCache);
      if (!resolved) {
        notFound.push({
          weekDate: week.date,
          position: row.position,
          artist: row.artist,
          title: row.title,
        });
        continue;
      }
      resolvedByPos.set(row.position, resolved);
      if (VERBOSE) {
        console.log(
          `[resolve] ${week.date} #${row.position} ${row.artist} – ${row.title} -> ${resolved.spotifyId ?? resolved.id}`,
        );
      }
    }

    const finalRows = week.entries.filter((r) => resolvedByPos.has(r.position));
    if (!finalRows.length) {
      console.log(`[warn] ${week.date}: nenhuma música resolvida, pulando (${week.slug})`);
      continue;
    }

    const missing = week.entries.length - finalRows.length;
    if (missing > 0) {
      console.log(
        `[warn] ${week.date}: ${finalRows.length}/${week.entries.length} resolvidas (${missing} miss)`,
      );
    }

    // peak/weeks/status/delta/prevPos são placeholders — recompute no fim.
    const entryPayload = finalRows.map((row) => {
      const resolved = resolvedByPos.get(row.position)!;
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
      console.log(
        `[dry-run] ${week.date} weekIndex=${weekIndex} ${finalRows.length} entradas (${week.slug})`,
      );
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
      maxItems: Math.max(...finalRows.map((r) => r.position), finalRows.length),
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
      const streak = computeStreakForCadence(
        primaryWeeks.map((w) => w.weekIndex),
        "WEEKLY",
      );
      await prisma.user.update({ where: { id: user.id }, data: { streak } });
      console.log(`[info] Streak atualizado: ${streak}`);
    }
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts criados: ${createdCharts}`);
  console.log(`Charts atualizados: ${updatedCharts}`);
  console.log(`Entradas inseridas: ${createdEntries}`);
  console.log(`Não encontradas: ${notFound.length}`);

  if (notFound.length) {
    console.log("");
    console.log("=== NÃO ENCONTRADAS ===");
    const unique = new Map<string, NotFoundRow>();
    for (const miss of notFound) {
      const key = crownnoteSongKey(miss.artist, miss.title);
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
