import { prisma } from "@/lib/prisma";
import { buildPeriodFromDate } from "@/lib/chart-cadence";
import {
  formatMyTrlEditionDisplay,
  myTrlTopEntries,
  toBrtDate,
  type MyTrlChartEntry,
} from "@/lib/mytrl-chart-engine";
import { UMS_REQUEST_LIVE_PARADA_ID } from "@/lib/mytrl-access";
import { generateMyTrlSnapshot } from "@/lib/mytrl-generate";
import { paletteFor, upsertSongFromSpotify } from "@/lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";

function localDateFromReference(referenceDay: Date): Date {
  const brt = toBrtDate(referenceDay);
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

  return prisma.song.create({
    data: { title: entry.track, artist: entry.artist, album: entry.album || null },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
}

export type PublishMyTrlDailyResult =
  | {
      ok: true;
      weekIndex: number;
      weekLabel: string;
      chartId: string;
      count: number;
      created: boolean;
    }
  | { ok: false; error: string; skipped?: boolean };

/** Publica top 10 diário na parada UMS Request Live a partir das entradas calculadas. */
export async function publishMyTrlDailyToUms(
  entries: MyTrlChartEntry[],
  referenceDay: Date,
  paradaId: string = UMS_REQUEST_LIVE_PARADA_ID,
): Promise<PublishMyTrlDailyResult> {
  const parada = await prisma.parada.findUnique({ where: { id: paradaId } });
  if (!parada) {
    return { ok: false, error: `Parada ${paradaId} não encontrada.` };
  }

  const chartSize = parada.chartSize ?? 10;
  const top = myTrlTopEntries(entries, chartSize);
  if (top.length === 0) {
    return { ok: false, error: "Nenhuma faixa no top 10." };
  }

  const localDate = localDateFromReference(referenceDay);
  const period = buildPeriodFromDate(localDate, "DAILY");
  const edition = formatMyTrlEditionDisplay(referenceDay);
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);

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

  const existing = await prisma.chart.findUnique({
    where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex: period.periodIndex } },
  });

  let chartId: string;
  let created = false;

  if (existing) {
    await prisma.$transaction([
      prisma.chartEntry.deleteMany({ where: { chartId: existing.id } }),
      prisma.chart.update({
        where: { id: existing.id },
        data: {
          weekLabel: edition.fullLabel,
          dateRange: period.dateRange,
          publishedAt: referenceDay,
          weekStartDate: localDate,
          maxItems: top.length,
          entries: { create: entryData },
        },
      }),
    ]);
    chartId = existing.id;
  } else {
    const chart = await prisma.chart.create({
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
    chartId = chart.id;
    created = true;
  }

  return {
    ok: true,
    weekIndex: period.periodIndex,
    weekLabel: edition.fullLabel,
    chartId,
    count: top.length,
    created,
  };
}

export type RunDailyMyTrlJobResult =
  | ({
      ok: true;
      snapshot: Awaited<ReturnType<typeof generateMyTrlSnapshot>> & { ok: true };
      publish: PublishMyTrlDailyResult & { ok: true };
    })
  | { ok: false; error: string; skipped?: boolean; stage?: "snapshot" | "publish" };

/** Calcula snapshot MyTRL e publica top 10 na UMS Request Live. */
export async function runDailyMyTrlJob(
  referenceDay: Date = new Date(),
  options?: { skipSnapshotRecompute?: boolean },
): Promise<RunDailyMyTrlJobResult> {
  const snapshot = await generateMyTrlSnapshot(referenceDay, {
    skipRecompute: options?.skipSnapshotRecompute,
  });
  if (!snapshot.ok) {
    return { ok: false, error: snapshot.error, skipped: snapshot.skipped, stage: "snapshot" };
  }

  const row = await prisma.myTrlSnapshot.findUnique({
    where: { weekday_weekIndex: { weekday: snapshot.weekday, weekIndex: snapshot.weekIndex } },
  });
  if (!row) {
    return { ok: false, error: "Snapshot salvo mas não encontrado.", stage: "publish" };
  }

  const publish = await publishMyTrlDailyToUms(
    row.entries as unknown as MyTrlChartEntry[],
    referenceDay,
  );
  if (!publish.ok) {
    return { ok: false, error: publish.error, skipped: publish.skipped, stage: "publish" };
  }

  return { ok: true, snapshot, publish };
}
