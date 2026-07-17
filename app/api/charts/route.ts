import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import { buildPeriodFromDate, computeStreakForCadence, prevPeriodIndex } from "@/lib/chart-cadence";
import { getSpotifyArtistById, getSpotifyTrackMetadataById, probeSpotifyApi, runWithSpotifyUserChartsPool, searchSpotifyArtist } from "@/lib/spotify-server";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";
import { resolveParadaForPublish } from "@/lib/paradas";
import {
  finalizeSongsForChartPublish,
  finalizeSongsForChartPublishWithFeedback,
  resolveSongsForFastPublish,
  sanitizeChartEntrySpotifyRefs,
} from "@/lib/resolve-publish-songs";
import {
  resolveOptionalSpotlightSongId,
  spotlightSongIdFromResolvedEntries,
} from "@/lib/chart-spotlight";

export const runtime = "nodejs";
export const maxDuration = 120;

type ResolvedSongRow = { id: string; spotifyId: string | null; albumSpotifyId: string | null };

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

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

type EntryInput = {
  title: string;
  artist: string;
  album?: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
  songId?: string | null;
};

function parseWeekDate(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  let entries: EntryInput[] = (body.entries ?? []).filter((e: EntryInput) => !isInstrumentalTitle(e.title));
  const fastPublish = body.fastPublish === true;

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "Adicione ao menos uma música" }, { status: 400 });
  }

  if (entries.length > 100) entries.splice(100);

  const userId = session.user.id;
  const today = new Date();
  const selectedDate = parseWeekDate(body.weekDate) ?? today;
  const parada = await resolveParadaForPublish(prisma, userId, body.paradaId ?? null);
  if (selectedDate.getTime() > today.getTime()) {
    return NextResponse.json(
      {
        error:
          parada.cadence === "DAILY"
            ? "Não é possível publicar parada em dia futuro"
            : "Não é possível publicar parada em semana futura",
      },
      { status: 400 },
    );
  }
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  const period = buildPeriodFromDate(selectedDate, parada.cadence);
  const weekIndex = period.periodIndex;
  const weekLabel = period.periodLabel;
  const dateRange = period.dateRange;
  const publishedAt = period.publishedAt;

  const existing = await prisma.chart.findUnique({
    where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
  });
  if (existing) {
    return NextResponse.json(
      {
        id: existing.id,
        error:
          parada.cadence === "DAILY"
            ? "Você já publicou esta parada neste dia"
            : "Você já publicou esta parada nesta semana",
      },
      { status: 409 },
    );
  }

  // Upsert songs/artists/albums — publicação rápida evita timeout do Spotify
  let songs: ResolvedSongRow[] = [];
  let enrichmentStats: { withCover: number; withoutCover: number; missingCoverIndices: number[] } | null = null;

  // Caminho lento faz dezenas de chamadas Spotify; sob rate limit (429), degrada para o
  // caminho rápido (só banco local) — a parada salva com o que se sabe e o cron de
  // backfill completa capas/metadados depois.
  // Pool user-charts: principal → backup → BACKUP2 (só aqui; BACKUP2 não serve o resto do app).
  await runWithSpotifyUserChartsPool(async () => {
  const useFastPath = fastPublish || !(await probeSpotifyApi()).ok;

  if (useFastPath) {
    const resolved = await resolveSongsForFastPublish(prisma, entries);
    const result = await finalizeSongsForChartPublishWithFeedback(prisma, entries, resolved);
    songs = result.songs;
    enrichmentStats = result.enrichmentStats;
  } else {
    songs = [];
    const spotifyArtistCache = new Map<string, Awaited<ReturnType<typeof getSpotifyArtistById>>>();
    const spotifyArtistNameCache = new Map<string, Awaited<ReturnType<typeof searchSpotifyArtist>>>();

    async function spotifyArtistProfile(spotifyId: string) {
      if (spotifyArtistCache.has(spotifyId)) return spotifyArtistCache.get(spotifyId)!;
      const p = await getSpotifyArtistById(spotifyId);
      spotifyArtistCache.set(spotifyId, p);
      return p;
    }

    async function spotifyArtistByName(name: string) {
      const key = name.trim().toLowerCase();
      if (spotifyArtistNameCache.has(key)) return spotifyArtistNameCache.get(key)!;
      const result = await searchSpotifyArtist(name);
      spotifyArtistNameCache.set(key, result);
      return result;
    }

    for (const e of entries) {
      const spotifyId = e.spotifyId?.trim() || null;
      if (!spotifyId) {
        const resolvedArtist = await spotifyArtistByName(e.artist);
        if (resolvedArtist) {
          await prisma.artist.upsert({
            where: { spotifyId: resolvedArtist.spotifyId },
            update: {
              name: resolvedArtist.name,
              genres: resolvedArtist.genres ?? [],
              spotifyUrl: resolvedArtist.spotifyUrl ?? undefined,
              ...(resolvedArtist.imageUrl ? { imageUrl: resolvedArtist.imageUrl } : {}),
            },
            create: {
              spotifyId: resolvedArtist.spotifyId,
              name: resolvedArtist.name,
              genres: resolvedArtist.genres ?? [],
              spotifyUrl: resolvedArtist.spotifyUrl ?? null,
              imageUrl: resolvedArtist.imageUrl ?? null,
            },
          });
        }
        const canonicalArtist = resolvedArtist?.name ?? e.artist;
        const existingSong = await prisma.song.findFirst({
          where: {
            title: e.title,
            artist: { in: [...new Set([e.artist, canonicalArtist])] },
          },
        });
        const song = existingSong
          ? await prisma.song.update({
              where: { id: existingSong.id },
              data: {
                ...(e.album ? { album: e.album } : {}),
                ...(resolvedArtist?.spotifyId ? { artistSpotifyId: resolvedArtist.spotifyId } : {}),
              },
            })
          : await prisma.song.create({
              data: {
                title: e.title,
                artist: canonicalArtist,
                album: e.album ?? null,
                artistSpotifyId: resolvedArtist?.spotifyId ?? null,
              },
            });
        songs.push({ id: song.id, spotifyId: song.spotifyId ?? null, albumSpotifyId: song.albumSpotifyId ?? null });
        continue;
      }

      const metadata = await getSpotifyTrackMetadataById(spotifyId);
      const primaryArtist = metadata?.primaryArtist;
      const albumSpotifyId = metadata?.album.spotifyId ?? null;
      const mainArtistName = primaryArtist?.name?.trim() || metadata?.artists?.[0]?.name?.trim() || e.artist;

      if (primaryArtist) {
        const profile = await spotifyArtistProfile(primaryArtist.spotifyId);
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
            title: metadata?.album.title ?? e.album ?? "Álbum",
            artistSpotifyId: primaryArtist.spotifyId,
            albumType: metadata?.album.albumType ?? undefined,
            releaseDate: metadata?.album.releaseDate ?? undefined,
            coverUrl: metadata?.album.coverUrl ?? undefined,
            spotifyUrl: metadata?.album.spotifyUrl ?? undefined,
            totalTracks: metadata?.album.totalTracks ?? undefined,
          },
          create: {
            spotifyId: albumSpotifyId,
            title: metadata?.album.title ?? e.album ?? "Álbum",
            artistSpotifyId: primaryArtist.spotifyId,
            albumType: metadata?.album.albumType ?? undefined,
            releaseDate: metadata?.album.releaseDate ?? undefined,
            coverUrl: metadata?.album.coverUrl ?? null,
            spotifyUrl: metadata?.album.spotifyUrl ?? null,
            totalTracks: metadata?.album.totalTracks ?? null,
          },
        });
      }

      const resolvedTitle = metadata?.title ?? e.title;
      const existingByName = await prisma.song.findFirst({
        where: { title: resolvedTitle, artist: mainArtistName },
        select: { id: true, spotifyId: true },
      });
      const song = existingByName
        ? await prisma.song.update({
            where: { id: existingByName.id },
            data: {
              ...(existingByName.spotifyId == null ? { spotifyId } : {}),
              album: metadata?.album.title ?? e.album ?? null,
              artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
              albumSpotifyId: albumSpotifyId ?? undefined,
              durationMs: metadata?.durationMs ?? undefined,
              previewUrl: metadata?.previewUrl ?? undefined,
              spotifyUrl: metadata?.spotifyUrl ?? undefined,
              trackNumber: metadata?.trackNumber ?? undefined,
            },
          })
        : await prisma.song.upsert({
            where: { spotifyId },
            update: {
              title: resolvedTitle,
              artist: mainArtistName,
              album: metadata?.album.title ?? e.album ?? null,
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
              album: metadata?.album.title ?? e.album ?? null,
              spotifyId,
              artistSpotifyId: primaryArtist?.spotifyId ?? null,
              albumSpotifyId,
              durationMs: metadata?.durationMs ?? null,
              previewUrl: metadata?.previewUrl ?? null,
              spotifyUrl: metadata?.spotifyUrl ?? null,
              trackNumber: metadata?.trackNumber ?? null,
            },
          });

      // Artistas secundários (feats) no relacionamento song_feats
      if (song.spotifyId) {
        const featured = metadata?.featuredArtists ?? [];
        const featIds = new Set<string>();
        for (const feat of featured) {
          featIds.add(feat.spotifyId);
          const featProfile = await spotifyArtistProfile(feat.spotifyId);
          await prisma.artist.upsert({
            where: { spotifyId: feat.spotifyId },
            update: {
              name: featProfile?.name ?? feat.name,
              genres: featProfile?.genres ?? [],
              spotifyUrl: (featProfile?.spotifyUrl ?? feat.spotifyUrl) ?? undefined,
              ...(featProfile?.imageUrl ? { imageUrl: featProfile.imageUrl } : {}),
            },
            create: {
              spotifyId: feat.spotifyId,
              name: featProfile?.name ?? feat.name,
              genres: featProfile?.genres ?? [],
              spotifyUrl: (featProfile?.spotifyUrl ?? feat.spotifyUrl) ?? null,
              imageUrl: featProfile?.imageUrl ?? null,
            },
          });
          await prisma.songFeat.upsert({
            where: {
              songSpotifyId_artistSpotifyId: {
                songSpotifyId: song.spotifyId,
                artistSpotifyId: feat.spotifyId,
              },
            },
            update: {},
            create: {
              songSpotifyId: song.spotifyId,
              artistSpotifyId: feat.spotifyId,
            },
          });
        }
        await prisma.songFeat.deleteMany({
          where: {
            songSpotifyId: song.spotifyId,
            ...(featIds.size ? { artistSpotifyId: { notIn: [...featIds] } } : {}),
          },
        });
      }

      songs.push({ id: song.id, spotifyId: song.spotifyId ?? null, albumSpotifyId: song.albumSpotifyId ?? null });
    }
  }
  });

  const spotifyRefs = await sanitizeChartEntrySpotifyRefs(prisma, songs);

  const flashbackEntry = body.flashback ?? null;
  const destaqueEntry = body.destaque ?? null;
  const [flashbackSongId, destaqueSongId] = await Promise.all([
    (async () => {
      const fromChart = spotlightSongIdFromResolvedEntries(flashbackEntry, entries, songs);
      if (fromChart) return fromChart;
      return resolveOptionalSpotlightSongId(prisma, flashbackEntry);
    })(),
    (async () => {
      const fromChart = spotlightSongIdFromResolvedEntries(destaqueEntry, entries, songs);
      if (fromChart) return fromChart;
      return resolveOptionalSpotlightSongId(prisma, destaqueEntry);
    })(),
  ]);

  // Previous chart for delta calculations
  const previousWeekIdx = prevPeriodIndex(weekIndex, parada.cadence);
  const previousChart = await prisma.chart.findFirst({
    where: { paradaId: parada.id, weekIndex: previousWeekIdx },
    include: { entries: true },
  });
  const historicalRows = await prisma.chartEntry.findMany({
    where: {
      songId: { in: [...new Set(songs.map((s) => s.id))] },
      chart: { paradaId: parada.id, weekIndex: { lt: weekIndex } },
    },
    select: { songId: true },
    distinct: ["songId"],
  });
  const historicalSongIds = new Set(historicalRows.map((r) => r.songId));

  const entryData = entries.map((e, i) => {
    const song = songs[i];
    const refs = spotifyRefs[i];
    const pos = i + 1;
    const chartSize = entries.length;
    const points = pointsForChartPosition(pos, scoringTier, chartSize, parada.cadence);
    const prev = previousChart?.entries.find((pe) => pe.songId === song.id);
    const { palette, seed } = paletteFor(e.artist, e.title);

    if (!prev) {
      return {
        songId: song.id,
        songSpotifyId: refs.songSpotifyId,
        albumSpotifyId: refs.albumSpotifyId,
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
      songSpotifyId: refs.songSpotifyId,
      albumSpotifyId: refs.albumSpotifyId,
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

  const chart = await prisma.chart.create({
    data: {
      userId,
      paradaId: parada.id,
      weekIndex,
      weekLabel,
      dateRange,
      publishedAt,
      maxItems: entries.length,
      flashbackSongId,
      destaqueSongId,
      entries: { create: entryData },
    },
  });

  if (parada.isPrimary) {
    const primaryWeeks = await prisma.chart.findMany({
      where: { userId, paradaId: parada.id },
      select: { weekIndex: true },
      orderBy: { weekIndex: "desc" },
    });
    const streak = computeStreakForCadence(primaryWeeks.map((w) => w.weekIndex), "WEEKLY");
    await prisma.user.update({ where: { id: userId }, data: { streak } });

    const MILESTONE_STREAKS = new Set([4, 8, 12, 16, 20, 26, 30, 36, 42, 52, 78, 104]);
    if (MILESTONE_STREAKS.has(streak)) {
      const milestoneText = `🎉 Streak de ${streak} semanas! Você publicou paradas por ${streak} semanas seguidas.`;
      const existing = await prisma.notification.findFirst({
        where: { recipientId: userId, type: "milestone", text: milestoneText },
        select: { id: true },
      });
      if (!existing) {
        await createNotification({ recipientId: userId, type: "milestone", text: milestoneText });
      }
    }
  }

  const response: {
    id: string;
    enrichmentWarning?: {
      missingCovers: number;
      message: string;
    };
  } = {
    id: chart.id,
  };

  // Aviso se mais de 10% das faixas ficaram sem capa — serão enriquecidas pelo cron noturno
  if (enrichmentStats && enrichmentStats.withoutCover > 0) {
    const ratio = enrichmentStats.withoutCover / entries.length;
    if (ratio > 0.1 || enrichmentStats.withoutCover >= 5) {
      response.enrichmentWarning = {
        missingCovers: enrichmentStats.withoutCover,
        message: `${enrichmentStats.withoutCover} faixa(s) ainda não têm capa. O sistema vai completar automaticamente nas próximas horas.`,
      };
    }
  }

  return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error("[POST /api/charts]", err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "Você já publicou esta parada neste período." },
          { status: 409 },
        );
      }
    }

    const code = err instanceof Prisma.PrismaClientInitializationError
      ? err.errorCode
      : (err as { code?: string }).code;
    if (code === "P1001" || code === "P1017") {
      return NextResponse.json(
        { error: "Banco de dados indisponível. Verifique se o Postgres está rodando e tente novamente." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Erro interno ao publicar a parada." }, { status: 500 });
  }
}
