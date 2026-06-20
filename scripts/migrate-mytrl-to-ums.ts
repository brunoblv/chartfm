import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { prisma } from "../lib/prisma";
import { buildPeriodFromDate } from "../lib/chart-cadence";
import { recomputePersistedChartEntryStatsForParada } from "../lib/chart-entry-stats";
import {
  formatMyTrlEditionDisplay,
  myTrlTopEntries,
  toBrtDate,
  type MyTrlChartEntry,
} from "../lib/mytrl-chart-engine";
import { paletteFor, upsertSongFromSpotify } from "../lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

const UMS_PARADA_ID = "cmc06e6c262cf93ad97616c3c";

function localDateFromComputedAt(computedAt: Date): Date {
  const brt = toBrtDate(computedAt);
  return new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
}

async function resolveSong(entry: MyTrlChartEntry) {
  if (entry.spotifyId) {
    return upsertSongFromSpotify(entry.spotifyId, {
      track: entry.track,
      artist: entry.artist,
      album: entry.album,
    });
  }

  const existing = await prisma.song.findFirst({
    where: { title: entry.track, artist: entry.artist },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
  if (existing) return existing;

  const created = await prisma.song.create({
    data: { title: entry.track, artist: entry.artist, album: entry.album || null },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
  return created;
}

async function main() {
  const parada = await prisma.parada.findUnique({
    where: { id: UMS_PARADA_ID },
    include: { user: { select: { id: true, handle: true } } },
  });
  if (!parada) {
    console.error("Parada UMS Request Live não encontrada.");
    process.exit(1);
  }

  const existingCharts = await prisma.chart.count({ where: { paradaId: parada.id } });
  console.log(`Parada: ${parada.name} (@${parada.user.handle})`);
  console.log(`Charts existentes (top 100): ${existingCharts}`);

  const deleted = await prisma.chart.deleteMany({ where: { paradaId: parada.id } });
  console.log(`Apagados: ${deleted.count} charts`);

  const snapshots = await prisma.myTrlSnapshot.findMany({
    orderBy: [{ computedAt: "asc" }],
  });
  console.log(`Snapshots MyTRL: ${snapshots.length}\n`);

  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const chartSize = parada.chartSize ?? 10;
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const snap of snapshots) {
    const top = myTrlTopEntries(snap.entries as unknown as MyTrlChartEntry[], chartSize);
    if (top.length === 0) {
      console.log(`SKIP ${snap.computedAt.toISOString().slice(0, 10)} — sem top ${chartSize}`);
      skip++;
      continue;
    }

    const referenceDay = snap.computedAt;
    const localDate = localDateFromComputedAt(referenceDay);
    const period = buildPeriodFromDate(localDate, "DAILY");
    const edition = formatMyTrlEditionDisplay(referenceDay);

    process.stdout.write(`${edition.fullLabel} (${period.periodIndex}) ... `);

    try {
      const songs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];
      for (const entry of top) {
        songs.push(await resolveSong(entry));
      }

      const entryData = top.map((entry, i) => {
        const song = songs[i];
        const pos = entry.position ?? i + 1;
        const points = pointsForChartPosition(pos, scoringTier, top.length, parada.cadence);
        const { palette, seed } = paletteFor(entry.artist, entry.track);

        return {
          songId: song.id,
          songSpotifyId: song.spotifyId,
          albumSpotifyId: song.albumSpotifyId,
          points,
          position: pos,
          status: entry.status,
          delta: entry.delta,
          prevPos: entry.prevPos,
          peak: entry.peak,
          weeks: entry.weeks,
          coverPaletteA: palette[0],
          coverPaletteB: palette[1],
          coverSeed: seed,
        };
      });

      await prisma.chart.create({
        data: {
          userId: parada.userId,
          paradaId: parada.id,
          weekIndex: period.periodIndex,
          weekLabel: edition.fullLabel,
          dateRange: period.dateRange,
          publishedAt: referenceDay,
          weekStartDate: localDate,
          maxItems: top.length,
          entries: { create: entryData },
        },
      });

      console.log(`OK — ${top.length} faixas`);
      ok++;
    } catch (err) {
      console.log(`FAIL — ${String(err)}`);
      fail++;
    }
  }

  console.log("\nRecalculando stats da parada...");
  const recomputed = await recomputePersistedChartEntryStatsForParada(prisma, parada.id);
  console.log(`Recomputados: ${recomputed.charts} charts, ${recomputed.entries} entradas`);

  const final = await prisma.chart.findMany({
    where: { paradaId: parada.id },
    select: { weekLabel: true, weekIndex: true, _count: { select: { entries: true } } },
    orderBy: { weekIndex: "asc" },
  });

  console.log(`\nConcluído: ${ok} publicadas, ${skip} ignoradas, ${fail} falhas`);
  console.log(`\nUMS Request Live agora tem ${final.length} paradas diárias:`);
  for (const c of final) {
    console.log(`  ${c.weekLabel} (${c.weekIndex}) — ${c._count.entries} faixas`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
