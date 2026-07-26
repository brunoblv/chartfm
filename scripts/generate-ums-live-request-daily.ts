/**
 * Gera paradas diárias Top 10 (UMS Live Request) a partir do Top 20 semanal
 * (Under My Skin Video) usando o algoritmo Disk MTV.
 *
 * Usage:
 *   npx tsx scripts/generate-ums-live-request-daily.ts --dry-run
 *   npx tsx scripts/generate-ums-live-request-daily.ts
 *   npx tsx scripts/generate-ums-live-request-daily.ts --week=200201
 *   npx tsx scripts/generate-ums-live-request-daily.ts --from=2011-01-01 --to=2015-12-31
 *   npx tsx scripts/generate-ums-live-request-daily.ts --from-year=2011 --to-year=2015
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildPeriodFromDate } from "../lib/chart-cadence";
import { getChartWeekRange } from "../lib/chart-week";
import {
  createSeededRandom,
  DISK_MTV_WEEKDAYS,
  generateWeeklyDailyCharts,
  type Top20Entry,
  type WeekdayLabel,
} from "../lib/disk-mtv-daily";
import { UMS_REQUEST_LIVE_PARADA_ID, UMS_VIDEO_WEEKLY_PARADA_ID } from "../lib/mytrl-access";
import { paletteFor } from "../lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

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
const WEEKLY_PARADA_ID = UMS_VIDEO_WEEKLY_PARADA_ID;
const DAILY_PARADA_ID = UMS_REQUEST_LIVE_PARADA_ID;

const DRY_RUN = process.argv.includes("--dry-run");
const WEEK_ARG = process.argv.find((a) => a.startsWith("--week="));
const WEEKLY_ID_ARG = process.argv.find((a) => a.startsWith("--weekly-parada-id="));
const DAILY_ID_ARG = process.argv.find((a) => a.startsWith("--daily-parada-id="));
const FROM_ARG = process.argv.find((a) => a.startsWith("--from="));
const TO_ARG = process.argv.find((a) => a.startsWith("--to="));
const FROM_YEAR_ARG = process.argv.find((a) => a.startsWith("--from-year="));
const TO_YEAR_ARG = process.argv.find((a) => a.startsWith("--to-year="));

/** Padrão: histórico importado até 2010. Sobrescreva com --to / --to-year / --from. */
const DEFAULT_FROM = "2001-01-01";
const DEFAULT_TO = "2010-12-31";

function parseYmdArg(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} inválido: use AAAA-MM-DD (recebido: ${value})`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} inválido: ${value}`);
  return date;
}

function resolveDateRange(): { from: Date; to: Date; fromLabel: string; toLabel: string } {
  let fromLabel = DEFAULT_FROM;
  let toLabel = DEFAULT_TO;

  if (FROM_YEAR_ARG) {
    const y = Number(FROM_YEAR_ARG.split("=")[1]);
    if (!Number.isFinite(y)) throw new Error("--from-year inválido");
    fromLabel = `${y}-01-01`;
  }
  if (TO_YEAR_ARG) {
    const y = Number(TO_YEAR_ARG.split("=")[1]);
    if (!Number.isFinite(y)) throw new Error("--to-year inválido");
    toLabel = `${y}-12-31`;
  }
  if (FROM_ARG) fromLabel = FROM_ARG.split("=").slice(1).join("=");
  if (TO_ARG) toLabel = TO_ARG.split("=").slice(1).join("=");

  const from = parseYmdArg(fromLabel, "--from");
  const to = parseYmdArg(toLabel, "--to");
  if (from.getTime() > to.getTime()) {
    throw new Error(`Intervalo inválido: --from (${fromLabel}) > --to (${toLabel})`);
  }
  return { from, to, fromLabel, toLabel };
}

function chartWeekAnchor(chart: {
  weekStartDate: Date | null;
  publishedAt: Date;
}): Date {
  const anchor = chart.weekStartDate ?? getChartWeekRange(chart.publishedAt).start;
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
}

function isChartInRange(
  chart: { weekStartDate: Date | null; publishedAt: Date },
  from: Date,
  to: Date,
): boolean {
  const anchor = chartWeekAnchor(chart);
  return anchor.getTime() >= from.getTime() && anchor.getTime() <= to.getTime();
}

function weekdayDate(weekStartMonday: Date, dayIndex: number): Date {
  const d = new Date(weekStartMonday);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

async function resolveParadas(userId: string) {
  const weeklyId = WEEKLY_ID_ARG?.split("=").slice(1).join("=") ?? WEEKLY_PARADA_ID;
  const dailyId = DAILY_ID_ARG?.split("=").slice(1).join("=") ?? DAILY_PARADA_ID;

  let weekly = await prisma.parada.findFirst({
    where: { id: weeklyId, userId, cadence: "WEEKLY" },
  });
  if (!weekly) {
    weekly = await prisma.parada.findFirst({
      where: {
        userId,
        cadence: "WEEKLY",
        name: { contains: "Under My Skin Video", mode: "insensitive" },
      },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    });
  }
  if (!weekly) {
    throw new Error(
      `Parada semanal não encontrada (id=${weeklyId}). Use --weekly-parada-id=<id>.`,
    );
  }

  let daily = await prisma.parada.findFirst({
    where: { id: dailyId, userId, cadence: "DAILY" },
  });
  if (!daily) {
    daily = await prisma.parada.findFirst({
      where: {
        userId,
        cadence: "DAILY",
        name: { contains: "Live Request", mode: "insensitive" },
      },
    });
  }
  if (!daily) {
    throw new Error(
      `Parada diária não encontrada (id=${dailyId}). Use --daily-parada-id=<id>.`,
    );
  }

  return { weekly, daily };
}

type SongRef = {
  songId: string;
  songSpotifyId: string | null;
  albumSpotifyId: string | null;
  artist: string;
  title: string;
};

async function loadPreviousDayEntries(
  paradaId: string,
  dayIndex: number,
): Promise<Map<string, { position: number; peak: number; weeks: number }>> {
  // Última parada publicada antes deste dia (pula fim de semana / gaps).
  const chart = await prisma.chart.findFirst({
    where: { paradaId, weekIndex: { lt: dayIndex } },
    orderBy: { weekIndex: "desc" },
    include: { entries: true },
  });
  const map = new Map<string, { position: number; peak: number; weeks: number }>();
  if (!chart) return map;
  for (const e of chart.entries) {
    map.set(e.songId, { position: e.position, peak: e.peak, weeks: e.weeks });
  }
  return map;
}

function buildEntryPayload(
  songs: SongRef[],
  positions: number[],
  scoringTier: ReturnType<typeof scoringTierFromPrimary>,
  cadence: "DAILY",
  prevBySong: Map<string, { position: number; peak: number; weeks: number }>,
) {
  return songs.map((song, i) => {
    const pos = positions[i] ?? i + 1;
    const prev = prevBySong.get(song.songId);
    const { palette, seed } = paletteFor(song.artist, song.title);
    let status = "new";
    let delta: number | null = null;
    let prevPos: number | null = null;
    let peak = pos;
    let weeks = 1;

    if (prev) {
      prevPos = prev.position;
      delta = prev.position - pos;
      status = delta > 0 ? "up" : delta < 0 ? "down" : "same";
      peak = Math.min(prev.peak, pos);
      weeks = prev.weeks + 1;
    }

    return {
      songId: song.songId,
      songSpotifyId: song.songSpotifyId,
      albumSpotifyId: song.albumSpotifyId,
      position: pos,
      points: pointsForChartPosition(pos, scoringTier, songs.length, cadence),
      status,
      delta,
      prevPos,
      peak,
      weeks,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    };
  });
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const { weekly, daily } = await resolveParadas(user.id);
  const { from, to, fromLabel, toLabel } = resolveDateRange();
  console.log(`[info] Fonte semanal: "${weekly.name}" (${weekly.id})`);
  console.log(`[info] Destino diário: "${daily.name}" (${daily.id})`);
  console.log(`[info] Período: ${fromLabel} a ${toLabel}`);

  const weekFilter = WEEK_ARG ? Number(WEEK_ARG.split("=")[1]) : null;
  const weeklyChartsAll = await prisma.chart.findMany({
    where: {
      paradaId: weekly.id,
      ...(weekFilter ? { weekIndex: weekFilter } : {}),
    },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: { song: { select: { id: true, title: true, artist: true } } },
      },
    },
    orderBy: { weekIndex: "asc" },
  });

  const weeklyCharts = weekFilter
    ? weeklyChartsAll
    : weeklyChartsAll.filter((c) => isChartInRange(c, from, to));

  console.log(
    `[info] Charts semanais a processar: ${weeklyCharts.length}` +
      (weeklyCharts.length !== weeklyChartsAll.length
        ? ` (de ${weeklyChartsAll.length} no total; filtro de datas)`
        : ""),
  );

  const scoringTier = scoringTierFromPrimary(daily.isPrimary);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalDays = 0;

  for (const wChart of weeklyCharts) {
    if (wChart.entries.length < 10) {
      console.log(`[skip] Semana ${wChart.weekIndex}: só ${wChart.entries.length} entradas`);
      skipped += 1;
      continue;
    }

    const top20: Top20Entry[] = wChart.entries.map((e) => ({
      pos: e.position,
      artist: e.song.artist,
      song: e.song.title,
    }));

    const songByTop20Pos = new Map<number, SongRef>();
    for (const e of wChart.entries) {
      songByTop20Pos.set(e.position, {
        songId: e.songId,
        songSpotifyId: e.songSpotifyId,
        albumSpotifyId: e.albumSpotifyId,
        artist: e.song.artist,
        title: e.song.title,
      });
    }

    const rnd = createSeededRandom(wChart.weekIndex);
    const dailyCharts = generateWeeklyDailyCharts(top20, { random: rnd });

    const anchor =
      wChart.weekStartDate ??
      getChartWeekRange(wChart.publishedAt).start;
    const weekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

    for (let dayIdx = 0; dayIdx < DISK_MTV_WEEKDAYS.length; dayIdx += 1) {
      const label = DISK_MTV_WEEKDAYS[dayIdx] as WeekdayLabel;
      const dayEntries = dailyCharts[label];
      if (dayEntries.length !== 10) {
        console.log(
          `[warn] ${wChart.weekLabel} ${label}: ${dayEntries.length} faixas (esperado 10)`,
        );
      }

      const localDate = weekdayDate(weekStart, dayIdx);
      if (localDate.getTime() < from.getTime() || localDate.getTime() > to.getTime()) {
        continue;
      }

      const period = buildPeriodFromDate(localDate, "DAILY");
      const prevBySong = await loadPreviousDayEntries(daily.id, period.periodIndex);

      const songs: SongRef[] = dayEntries.map((d) => {
        const ref = songByTop20Pos.get(d.top20Pos);
        if (!ref) {
          throw new Error(
            `Música não mapeada: ${d.artist} - ${d.song} (top20 #${d.top20Pos})`,
          );
        }
        return ref;
      });

      const entryPayload = buildEntryPayload(
        songs,
        dayEntries.map((d) => d.pos),
        scoringTier,
        "DAILY",
        prevBySong,
      );

      if (DRY_RUN) {
        console.log(
          `[dry-run] ${period.dateRange} (${label}) semana ${wChart.weekIndex}: ${entryPayload.length} faixas`,
        );
        totalDays += 1;
        continue;
      }

      const existing = await prisma.chart.findUnique({
        where: { paradaId_weekIndex: { paradaId: daily.id, weekIndex: period.periodIndex } },
        select: { id: true },
      });

      const chartData = {
        weekLabel: `${label} — ${period.periodLabel}`,
        dateRange: period.dateRange,
        publishedAt: period.publishedAt,
        weekStartDate: localDate,
        maxItems: entryPayload.length,
        entries: { create: entryPayload },
      };

      if (existing) {
        await prisma.$transaction([
          prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
          prisma.chart.update({ where: { id: existing.id }, data: chartData }),
        ]);
        updated += 1;
      } else {
        await prisma.chart.create({
          data: {
            userId: user.id,
            paradaId: daily.id,
            weekIndex: period.periodIndex,
            ...chartData,
          },
        });
        created += 1;
      }
      totalDays += 1;
    }

    if (!DRY_RUN) {
      console.log(`[ok] Semana ${wChart.weekIndex} (${wChart.weekLabel}) → 5 dias gerados`);
    }
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts diários criados: ${created}`);
  console.log(`Charts diários atualizados: ${updated}`);
  console.log(`Dias gerados: ${totalDays}`);
  console.log(`Semanas semanais puladas: ${skipped}`);
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
