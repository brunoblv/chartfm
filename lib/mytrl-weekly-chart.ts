import { prisma } from "@/lib/prisma";
import { buildPeriodFromDate, prevPeriodIndex } from "@/lib/chart-cadence";
import { recomputePersistedChartEntryStats } from "@/lib/chart-entry-stats";
import { getChartWeekRange } from "@/lib/chart-week";
import { MYTRL_WEEKLY_PARADA_ID, MYTRL_WEEKLY_PUBLISH_UTC_HOUR, MYTRL_WEEKLY_PUBLISH_UTC_MINUTE } from "@/lib/mytrl-access";
import {
  brtWeekday,
  buildMyTrlPeriod,
  type MyTrlChartEntry,
  toBrtDate,
} from "@/lib/mytrl-chart-engine";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import { getSpotifyArtistById, getSpotifyTrackMetadataById } from "@/lib/spotify-server";

const WEEKLY_TOP_SIZE = 20;

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

export function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

function trackAggregateKey(entry: MyTrlChartEntry): string {
  if (entry.spotifyId) return `sp:${entry.spotifyId}`;
  return `na:${entry.track.toLowerCase()}|||${entry.artist.toLowerCase()}`;
}

export type WeeklyMyTrlCandidate = {
  track: string;
  artist: string;
  album: string;
  spotifyId: string;
  imageUrl: string | null;
  weeklyScore: number;
};

/** Soma os scores diários (seg–sex) de cada faixa na semana ISO. */
export function aggregateMyTrlWeeklyScores(
  snapshots: Array<{ weekday: number; entries: MyTrlChartEntry[] }>,
): WeeklyMyTrlCandidate[] {
  const byKey = new Map<string, WeeklyMyTrlCandidate>();

  for (const snap of snapshots) {
    if (snap.weekday < 1 || snap.weekday > 5) continue;
    for (const entry of snap.entries) {
      if (!entry.spotifyId || entry.score <= 0) continue;
      const key = trackAggregateKey(entry);
      const cur = byKey.get(key);
      if (!cur) {
        byKey.set(key, {
          track: entry.track,
          artist: entry.artist,
          album: entry.album,
          spotifyId: entry.spotifyId,
          imageUrl: entry.imageUrl,
          weeklyScore: entry.score,
        });
      } else {
        cur.weeklyScore += entry.score;
        if (entry.imageUrl) cur.imageUrl = entry.imageUrl;
      }
    }
  }

  return [...byKey.values()]
    .map((c) => ({ ...c, weeklyScore: Math.round(c.weeklyScore * 100) / 100 }))
    .sort((a, b) => b.weeklyScore - a.weeklyScore)
    .slice(0, WEEKLY_TOP_SIZE);
}

export async function upsertSongFromSpotify(
  spotifyId: string,
  fallback: Pick<WeeklyMyTrlCandidate, "track" | "artist" | "album">,
) {
  const metadata = await getSpotifyTrackMetadataById(spotifyId);
  const resolvedTitle = metadata?.title ?? fallback.track;
  if (isInstrumentalTitle(resolvedTitle) || isInstrumentalTitle(fallback.track)) {
    throw new Error("Faixas instrumentais não podem ser importadas do Spotify.");
  }
  const primaryArtist = metadata?.primaryArtist;
  const albumSpotifyId = metadata?.album.spotifyId ?? null;
  const mainArtistName = primaryArtist?.name?.trim() || metadata?.artists?.[0]?.name?.trim() || fallback.artist;

  if (primaryArtist) {
    const profile = await getSpotifyArtistById(primaryArtist.spotifyId);
    await prisma.artist.upsert({
      where: { spotifyId: primaryArtist.spotifyId },
      update: {
        name: profile?.name ?? primaryArtist.name,
        genres: profile?.genres ?? [],
        spotifyUrl: (profile?.spotifyUrl ?? primaryArtist.spotifyUrl) ?? undefined,
        ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
      },
      create: {
        spotifyId: primaryArtist.spotifyId,
        name: profile?.name ?? primaryArtist.name,
        genres: profile?.genres ?? [],
        spotifyUrl: (profile?.spotifyUrl ?? primaryArtist.spotifyUrl) ?? null,
        imageUrl: profile?.imageUrl ?? null,
      },
    });
  }

  if (primaryArtist && albumSpotifyId) {
    await prisma.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: metadata?.album.title ?? fallback.album ?? "Álbum",
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: metadata?.album.albumType ?? undefined,
        releaseDate: metadata?.album.releaseDate ?? undefined,
        coverUrl: metadata?.album.coverUrl ?? undefined,
        spotifyUrl: metadata?.album.spotifyUrl ?? undefined,
        totalTracks: metadata?.album.totalTracks ?? undefined,
      },
      create: {
        spotifyId: albumSpotifyId,
        title: metadata?.album.title ?? fallback.album ?? "Álbum",
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: metadata?.album.albumType ?? undefined,
        releaseDate: metadata?.album.releaseDate ?? undefined,
        coverUrl: metadata?.album.coverUrl ?? null,
        spotifyUrl: metadata?.album.spotifyUrl ?? null,
        totalTracks: metadata?.album.totalTracks ?? null,
      },
    });
  }

  // A song may exist without a spotifyId under the same title+artist.
  // Upserting by spotifyId would try to CREATE and hit the (title,artist) unique constraint.
  const existingByName = await prisma.song.findFirst({
    where: { title: resolvedTitle, artist: mainArtistName },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
  if (existingByName) {
    const song = await prisma.song.update({
      where: { id: existingByName.id },
      data: {
        ...(existingByName.spotifyId == null ? { spotifyId } : {}),
        album: metadata?.album.title ?? fallback.album ?? null,
        artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
        albumSpotifyId: albumSpotifyId ?? undefined,
        durationMs: metadata?.durationMs ?? undefined,
        previewUrl: metadata?.previewUrl ?? undefined,
        spotifyUrl: metadata?.spotifyUrl ?? undefined,
        trackNumber: metadata?.trackNumber ?? undefined,
      },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    return { id: song.id, spotifyId: song.spotifyId, albumSpotifyId: song.albumSpotifyId };
  }

  const song = await prisma.song.upsert({
    where: { spotifyId },
    update: {
      title: resolvedTitle,
      artist: mainArtistName,
      album: metadata?.album.title ?? fallback.album ?? null,
      artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
      albumSpotifyId: albumSpotifyId ?? undefined,
      durationMs: metadata?.durationMs ?? undefined,
      previewUrl: metadata?.previewUrl ?? undefined,
      spotifyUrl: metadata?.spotifyUrl ?? undefined,
      trackNumber: metadata?.trackNumber ?? undefined,
    },
    create: {
      title: resolvedTitle,
      artist: mainArtistName,
      album: metadata?.album.title ?? fallback.album ?? null,
      spotifyId,
      artistSpotifyId: primaryArtist?.spotifyId ?? null,
      albumSpotifyId,
      durationMs: metadata?.durationMs ?? null,
      previewUrl: metadata?.previewUrl ?? null,
      spotifyUrl: metadata?.spotifyUrl ?? null,
      trackNumber: metadata?.trackNumber ?? null,
    },
  });

  return {
    id: song.id,
    spotifyId: song.spotifyId,
    albumSpotifyId: song.albumSpotifyId,
  };
}

export type PublishMyTrlWeeklyResult =
  | {
      ok: true;
      weekIndex: number;
      weekLabel: string;
      chartId: string;
      count: number;
      created: boolean;
    }
  | { ok: false; error: string; skipped?: boolean };

/** Publica top 20 semanal na parada @bruno a partir dos snapshots MyTRL seg–sex. */
export async function publishMyTrlWeeklyChart(referenceDay: Date = new Date()): Promise<PublishMyTrlWeeklyResult> {
  const weekday = brtWeekday(referenceDay);
  if (weekday !== 5) {
    return { ok: false, error: "Parada semanal MyTRL só publica às sextas.", skipped: true };
  }

  const parada = await prisma.parada.findUnique({
    where: { id: MYTRL_WEEKLY_PARADA_ID },
    include: { user: { select: { id: true, handle: true } } },
  });
  if (!parada) {
    return { ok: false, error: `Parada ${MYTRL_WEEKLY_PARADA_ID} não encontrada.` };
  }

  const brt = toBrtDate(referenceDay);
  const localDate = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
  const { weekIndex } = buildMyTrlPeriod(referenceDay);
  const period = buildPeriodFromDate(localDate, "WEEKLY");
  const { start: weekStart } = getChartWeekRange(localDate);

  const snapshots = await prisma.myTrlSnapshot.findMany({
    where: { weekIndex, weekday: { in: [1, 2, 3, 4, 5] } },
    orderBy: { weekday: "asc" },
  });

  if (snapshots.length === 0) {
    return { ok: false, error: "Nenhum snapshot MyTRL nesta semana." };
  }

  const ranked = aggregateMyTrlWeeklyScores(
    snapshots.map((s) => ({
      weekday: s.weekday,
      entries: s.entries as unknown as MyTrlChartEntry[],
    })),
  );

  if (ranked.length === 0) {
    return { ok: false, error: "Nenhuma faixa com pontos na semana." };
  }

  const songs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];
  for (const candidate of ranked) {
    songs.push(await upsertSongFromSpotify(candidate.spotifyId, candidate));
  }

  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const previousWeekIdx = prevPeriodIndex(period.periodIndex, "WEEKLY");
  const previousChart = await prisma.chart.findFirst({
    where: { paradaId: parada.id, weekIndex: previousWeekIdx },
    include: { entries: true },
  });
  const historicalRows = await prisma.chartEntry.findMany({
    where: {
      songId: { in: [...new Set(songs.map((s) => s.id))] },
      chart: { paradaId: parada.id, weekIndex: { lt: period.periodIndex } },
    },
    select: { songId: true },
    distinct: ["songId"],
  });
  const historicalSongIds = new Set(historicalRows.map((r) => r.songId));

  const entryData = ranked.map((candidate, i) => {
    const song = songs[i];
    const pos = i + 1;
    const points = pointsForChartPosition(pos, scoringTier, ranked.length, parada.cadence);
    const prev = previousChart?.entries.find((pe) => pe.songId === song.id);
    const { palette, seed } = paletteFor(candidate.artist, candidate.track);

    if (!prev) {
      return {
        songId: song.id,
        songSpotifyId: song.spotifyId,
        albumSpotifyId: song.albumSpotifyId,
        points,
        position: pos,
        status: historicalSongIds.has(song.id) ? "return" : "new",
        delta: null,
        prevPos: null,
        peak: pos,
        weeks: 1,
        coverPaletteA: palette[0],
        coverPaletteB: palette[1],
        coverSeed: seed,
      };
    }

    const delta = prev.position - pos;
    return {
      songId: song.id,
      songSpotifyId: song.spotifyId,
      albumSpotifyId: song.albumSpotifyId,
      points,
      position: pos,
      status: delta > 0 ? "up" : delta < 0 ? "down" : "same",
      delta,
      prevPos: prev.position,
      peak: Math.min(pos, prev.peak),
      weeks: prev.weeks + 1,
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
          weekLabel: period.periodLabel,
          dateRange: period.dateRange,
          publishedAt: referenceDay,
          weekStartDate: weekStart,
          maxItems: ranked.length,
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
        weekLabel: period.periodLabel,
        dateRange: period.dateRange,
        publishedAt: referenceDay,
        weekStartDate: weekStart,
        maxItems: ranked.length,
        entries: { create: entryData },
      },
    });
    chartId = chart.id;
    created = true;
  }

  await recomputePersistedChartEntryStats(prisma, parada.userId, period.periodIndex);

  return {
    ok: true,
    weekIndex: period.periodIndex,
    weekLabel: period.periodLabel,
    chartId,
    count: ranked.length,
    created,
  };
}

/** Data de referência simulando publicação semanal às 8:05 BRT (sexta). */
export function parseMyTrlWeeklyReferenceDate(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const reference = new Date(
    `${dateKey}T${String(MYTRL_WEEKLY_PUBLISH_UTC_HOUR).padStart(2, "0")}:${String(MYTRL_WEEKLY_PUBLISH_UTC_MINUTE).padStart(2, "0")}:00.000Z`,
  );
  if (Number.isNaN(reference.getTime())) return null;
  if (brtWeekday(reference) !== 5) return null;
  const brt = toBrtDate(reference);
  const key = `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}-${String(brt.getUTCDate()).padStart(2, "0")}`;
  if (key !== dateKey) return null;
  if (reference.getTime() > Date.now()) return null;
  return reference;
}
