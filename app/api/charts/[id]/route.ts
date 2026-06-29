import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { inferCadenceFromWeekIndex, prevPeriodIndex } from "@/lib/chart-cadence";
import { lastfmWeekPickerValueFromChart } from "@/lib/chart-week";
import { mapPrismaChartDetail } from "@/lib/map-db-profile";
import { hydrateChartEntryCoverUrls, hydrateDropoutCoverUrls, resolveChartEntryCoverUrl } from "@/lib/chart-entry-cover";
import { recomputePersistedChartEntryStatsForParada } from "@/lib/chart-entry-stats";
import type { PersonalDropoutEntry } from "@/lib/types";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";
import {
  finalizeSongsForChartPublish,
  resolveSongsForFastPublish,
  sanitizeChartEntrySpotifyRefs,
} from "@/lib/resolve-publish-songs";
import { isParadaVisibleToViewer } from "@/lib/mytrl-access";

export const runtime = "nodejs";
export const maxDuration = 120;
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
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

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28)));
}

function prevWeekIndex(index: number): number {
  const year = Math.floor(index / 100);
  const week = index % 100;
  if (week > 1) return year * 100 + (week - 1);
  const prevYear = year - 1;
  return prevYear * 100 + isoWeeksInYear(prevYear);
}

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const row = await prisma.chart.findUnique({
    where: { id: chartId },
    select: {
      id: true,
      userId: true,
      paradaId: true,
      weekIndex: true,
      weekLabel: true,
      dateRange: true,
      likes: true,
      comments: true,
      reposts: true,
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          bio: true,
          followers: true,
          following: true,
          streak: true,
          verified: true,
          image: true,
          paradaLogo: true,
        },
      },
      entries: {
        orderBy: { position: "asc" },
        include: {
          albumBySpotify: { select: { coverUrl: true } },
          song: {
            include: {
              albumRef: {
                select: { id: true, coverUrl: true },
              },
              artistRef: {
                select: { id: true, name: true },
              },
              feats: {
                include: {
                  artist: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  if (!isParadaVisibleToViewer(row.paradaId, session?.user?.handle)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const cadence = inferCadenceFromWeekIndex(row.weekIndex);
  const currentSongIds = [...new Set(row.entries.map((e) => e.songId))];
  const [previousChartFull, nextChart] = await Promise.all([
    prisma.chart.findFirst({
      where: { paradaId: row.paradaId, weekIndex: { lt: row.weekIndex } },
      orderBy: { weekIndex: "desc" },
      include: {
        entries: {
          orderBy: { position: "asc" },
          include: {
            albumBySpotify: { select: { coverUrl: true } },
            song: {
              include: {
                albumRef: { select: { id: true, coverUrl: true } },
                artistRef: { select: { id: true, name: true } },
                feats: { include: { artist: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.chart.findFirst({
      where: { paradaId: row.paradaId, weekIndex: { gt: row.weekIndex } },
      orderBy: { weekIndex: "asc" },
      select: { id: true, weekLabel: true },
    }),
  ]);
  const previousChart = previousChartFull
    ? { id: previousChartFull.id, weekLabel: previousChartFull.weekLabel }
    : null;

  const [historyAgg, personalOnesAgg, globalOnesAgg, prevPositionsRaw] =
    currentSongIds.length === 0
      ? [[], [], [], []] as const
      : await Promise.all([
          prisma.chartEntry.groupBy({
            by: ["songId"],
            where: {
              songId: { in: currentSongIds },
              chart: { paradaId: row.paradaId, weekIndex: { lte: row.weekIndex } },
            },
            _count: { _all: true },
            _min: { position: true },
          }),
          prisma.chartEntry.groupBy({
            by: ["songId"],
            where: {
              songId: { in: currentSongIds },
              position: 1,
              chart: { paradaId: row.paradaId, weekIndex: { lte: row.weekIndex } },
            },
            _count: { _all: true },
          }),
          prisma.chartEntry.groupBy({
            by: ["songId"],
            where: { position: 1, songId: { in: currentSongIds } },
            _count: { _all: true },
          }),
          prisma.chartEntry.findMany({
            where: {
              songId: { in: currentSongIds },
              chart: { paradaId: row.paradaId, weekIndex: { lt: row.weekIndex } },
            },
            select: { songId: true, position: true, chart: { select: { weekIndex: true } } },
            orderBy: [{ chart: { weekIndex: "desc" } }],
          }),
        ]);

  const historyBySong = new Map(
    historyAgg.map((h) => [h.songId, { weeks: h._count._all, peak: h._min.position ?? null }]),
  );
  const personalOnesBySong = new Map(personalOnesAgg.map((h) => [h.songId, h._count._all]));
  const globalOnesBySong = new Map(globalOnesAgg.map((h) => [h.songId, h._count._all]));

  const personalNumberOnes: Record<string, number> = {};
  for (const [songId, total] of personalOnesBySong.entries()) {
    personalNumberOnes[songId] = total;
  }

  const globalNumberOnes: Record<string, number> = {};
  for (const [songId, total] of globalOnesBySong.entries()) {
    globalNumberOnes[songId] = total;
  }

  const entriesWithComputedStats = row.entries.filter((entry) => entry.song).map((entry) => {
    const hist = historyBySong.get(entry.songId);
    const weeks = hist?.weeks ?? 1;
    const peak = hist?.peak ?? entry.position;
    const expectedPrevWeek = prevPeriodIndex(row.weekIndex, cadence);
    const prevPos =
      prevPositionsRaw.find((h) => h.songId === entry.songId && h.chart.weekIndex === expectedPrevWeek)?.position ?? null;
    const delta = prevPos === null ? null : prevPos - entry.position;
    const hasOlderAppearance = prevPositionsRaw.some(
      (h) => h.songId === entry.songId && h.chart.weekIndex < expectedPrevWeek,
    );
    let status: "new" | "return" | "up" | "down" | "same" = hasOlderAppearance ? "return" : "new";
    if (prevPos !== null) {
      if (delta === 0) status = "same";
      else if ((delta ?? 0) > 0) status = "up";
      else status = "down";
    }

    return {
      ...entry,
      status,
      delta,
      prevPos,
      peak,
      weeks,
    };
  });

  const currentSongIdSet = new Set(currentSongIds);
  const dropouts: PersonalDropoutEntry[] = (previousChartFull?.entries ?? [])
    .filter((e) => e.song && !currentSongIdSet.has(e.songId))
    .sort((a, b) => a.position - b.position)
    .map((e) => {
      const song = e.song!;
      const img = resolveChartEntryCoverUrl(e);
      return {
        lastPos: e.position,
        song: {
          id: song.id,
          title: song.exhibitionName?.trim() || song.title,
          artist: song.artistRef?.name?.trim() || song.artist,
          slugArtist: song.artist,
          featArtists: (song.feats ?? []).map((f) => f.artist?.name).filter((name): name is string => Boolean(name)),
          album: song.album ?? "",
          spotifyId: song.spotifyId ?? null,
          artistSpotifyId: song.artistSpotifyId ?? null,
          artistRefId: song.artistRef?.id ?? null,
          albumRefId: song.albumRef?.id ?? null,
          imageUrl: img,
        },
        cover: {
          palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
          seed: e.coverSeed,
          imageUrl: img,
        },
        peak: e.peak,
        weeks: e.weeks,
        points: e.points,
      };
    });

  let liked = false;
  let reposted = false;
  if (session?.user?.id) {
    const [like, repost] = await Promise.all([
      prisma.chartLike.findUnique({
        where: { userId_chartId: { userId: session.user.id, chartId: row.id } },
        select: { id: true },
      }),
      prisma.chartRepost.findUnique({
        where: { userId_chartId: { userId: session.user.id, chartId: row.id } },
        select: { id: true },
      }),
    ]);
    liked = !!like;
    reposted = !!repost;
  }

  const mapped = mapPrismaChartDetail({ ...row, entries: entriesWithComputedStats });
  mapped.chart.entries = await hydrateChartEntryCoverUrls(prisma, mapped.chart.entries);
  const hydratedDropouts = await hydrateDropoutCoverUrls(prisma, dropouts);
  const lastfmImportWeekDate = lastfmWeekPickerValueFromChart(mapped.chart);

  return NextResponse.json(
    {
      ...mapped,
      lastfmImportWeekDate,
      previousChart,
      nextChart,
      personalNumberOnes,
      globalNumberOnes,
      liked,
      reposted,
      dropouts: hydratedDropouts,
    },
    { headers: NO_CACHE_HEADERS },
  );
  } catch (err) {
    console.error("[GET /api/charts/[id]]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

type EntryInput = {
  title: string;
  artist: string;
  album?: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
  songId?: string | null;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = (await req.json()) as { entries?: EntryInput[] };
  const entries = body.entries ?? [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "Adicione ao menos uma música" }, { status: 400 });
  }
  if (entries.length > 100) entries.splice(100);

  for (const e of entries) {
    if (!e.title?.trim() || !e.artist?.trim()) {
      return NextResponse.json(
        { error: "Entrada inválida: título e artista são obrigatórios" },
        { status: 400 },
      );
    }
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: {
      id: true,
      userId: true,
      paradaId: true,
      weekIndex: true,
      parada: { select: { isPrimary: true } },
    },
  });
  if (!chart) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (chart.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const cadence = inferCadenceFromWeekIndex(chart.weekIndex);
  const scoringTier = scoringTierFromPrimary(chart.parada.isPrimary);
  const chartSize = entries.length;

  const normalizedEntries = entries.map((e) => ({
    title: e.title.trim(),
    artist: e.artist.trim(),
    album: e.album ?? null,
    imageUrl: e.imageUrl?.trim() || null,
    spotifyId: e.spotifyId?.trim() || null,
    songId: e.songId?.trim() || null,
  }));

  const resolved = await resolveSongsForFastPublish(prisma, normalizedEntries);
  const songs = await finalizeSongsForChartPublish(prisma, normalizedEntries, resolved);
  if (songs.length !== entries.length || songs.some((s) => !s?.id)) {
    return NextResponse.json({ error: "Não foi possível resolver todas as músicas." }, { status: 400 });
  }

  const spotifyRefs = await sanitizeChartEntrySpotifyRefs(prisma, songs);

  const previousChart = await prisma.chart.findFirst({
    where: { paradaId: chart.paradaId, weekIndex: prevPeriodIndex(chart.weekIndex, cadence) },
    include: { entries: true },
  });
  const historicalRows = await prisma.chartEntry.findMany({
    where: {
      songId: { in: [...new Set(songs.map((s) => s.id))] },
      chart: { paradaId: chart.paradaId, weekIndex: { lt: chart.weekIndex } },
    },
    select: { songId: true },
    distinct: ["songId"],
  });
  const historicalSongIds = new Set(historicalRows.map((r) => r.songId));

  const entryData = entries.map((e, i) => {
    const song = songs[i];
    const refs = spotifyRefs[i];
    const pos = i + 1;
    const points = pointsForChartPosition(pos, scoringTier, chartSize, cadence);
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

  await prisma.$transaction([
    prisma.chartEntry.deleteMany({ where: { chartId } }),
    prisma.chart.update({
      where: { id: chartId },
      data: {
        maxItems: entries.length,
        entries: { create: entryData },
      },
    }),
  ]);
  await recomputePersistedChartEntryStatsForParada(prisma, chart.paradaId, chart.weekIndex);

  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/charts/[id]]", err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003") {
        return NextResponse.json(
          { error: "Referência inválida ao salvar uma música. Tente remover e adicionar a faixa de novo." },
          { status: 400 },
        );
      }
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "Música duplicada no catálogo. Verifique título e artista." },
          { status: 409 },
        );
      }
    }

    const code = err instanceof Prisma.PrismaClientInitializationError
      ? err.errorCode
      : (err as { code?: string }).code;
    if (code === "P1001" || code === "P1017") {
      return NextResponse.json(
        { error: "Banco de dados indisponível. Tente novamente em instantes." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Erro interno ao salvar a parada." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, userId: true },
  });
  if (!chart) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (chart.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.chart.delete({
    where: { id: chartId },
  });

  return NextResponse.json({ ok: true });
}
