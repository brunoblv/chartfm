import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mapPrismaChartDetail } from "@/lib/map-db-profile";

export const runtime = "nodejs";

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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;
  const chartId = typeof id === "string" ? id.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const row = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
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
        },
      },
      entries: {
        orderBy: { position: "asc" },
        include: {
          song: {
            include: {
              artistRef: {
                select: { name: true },
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
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const currentSongIds = [...new Set(row.entries.map((e) => e.songId))];
  const songIdToKey = new Map(row.entries.map((e) => [e.songId, `${e.song.title}\0${e.song.artist}`]));

  const [history, globalOnes] = await Promise.all([
    prisma.chartEntry.findMany({
      where: {
        songId: { in: currentSongIds },
        chart: { userId: row.userId, weekIndex: { lte: row.weekIndex } },
      },
      select: { songId: true, position: true, chart: { select: { weekIndex: true } } },
    }),
    prisma.chartEntry.findMany({
      where: { position: 1, songId: { in: currentSongIds } },
      select: { songId: true },
    }),
  ]);
  const [previousChart, nextChart] = await Promise.all([
    prisma.chart.findFirst({
      where: { userId: row.userId, weekIndex: { lt: row.weekIndex } },
      orderBy: { weekIndex: "desc" },
      select: { id: true, weekLabel: true },
    }),
    prisma.chart.findFirst({
      where: { userId: row.userId, weekIndex: { gt: row.weekIndex } },
      orderBy: { weekIndex: "asc" },
      select: { id: true, weekLabel: true },
    }),
  ]);

  const personalNumberOnes: Record<string, number> = {};
  for (const h of history) {
    if (h.position === 1) {
      const key = songIdToKey.get(h.songId);
      if (key) personalNumberOnes[key] = (personalNumberOnes[key] ?? 0) + 1;
    }
  }

  const globalNumberOnes: Record<string, number> = {};
  for (const g of globalOnes) {
    const key = songIdToKey.get(g.songId);
    if (key) globalNumberOnes[key] = (globalNumberOnes[key] ?? 0) + 1;
  }

  const bySong = new Map<string, { weekIndex: number; position: number }[]>();
  for (const h of history) {
    const arr = bySong.get(h.songId) ?? [];
    arr.push({ weekIndex: h.chart.weekIndex, position: h.position });
    bySong.set(h.songId, arr);
  }

  const entriesWithComputedStats = row.entries.map((entry) => {
    const hist = bySong.get(entry.songId) ?? [];
    const weeks = hist.length;
    const peak = hist.length ? Math.min(...hist.map((h) => h.position)) : entry.position;
    const prev = hist
      .filter((h) => h.weekIndex < row.weekIndex)
      .sort((a, b) => b.weekIndex - a.weekIndex)[0];
    const prevPos = prev?.position ?? null;
    const delta = prevPos === null ? null : prevPos - entry.position;
    let status: "new" | "up" | "down" | "same" = "new";
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

  return NextResponse.json({
    ...mapPrismaChartDetail({ ...row, entries: entriesWithComputedStats }),
    previousChart,
    nextChart,
    personalNumberOnes,
    globalNumberOnes,
    liked,
    reposted,
  });
}

type EntryInput = {
  title: string;
  artist: string;
  album?: string | null;
  spotifyId?: string | null;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  if (entries.length > 1000) {
    return NextResponse.json({ error: "Limite de 1000 músicas por parada" }, { status: 400 });
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: { id: true, userId: true, weekIndex: true },
  });
  if (!chart) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (chart.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const songs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];
  for (const e of entries) {
    const title = e.title?.trim();
    const artist = e.artist?.trim();
    if (!title || !artist) {
      return NextResponse.json({ error: "Entrada inválida: título e artista são obrigatórios" }, { status: 400 });
    }
    const spotifyId = e.spotifyId?.trim() || null;
    if (spotifyId) {
      const song = await prisma.song.upsert({
        where: { spotifyId },
        update: {
          title,
          artist,
          album: e.album ?? null,
        },
        create: {
          title,
          artist,
          album: e.album ?? null,
          spotifyId,
        },
      });
      songs.push({ id: song.id, spotifyId: song.spotifyId ?? null, albumSpotifyId: song.albumSpotifyId ?? null });
      continue;
    }

    const existingSong = await prisma.song.findFirst({
      where: { title, artist },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    if (existingSong) {
      songs.push({ id: existingSong.id, spotifyId: existingSong.spotifyId, albumSpotifyId: existingSong.albumSpotifyId });
      continue;
    }
    const song = await prisma.song.create({
      data: { title, artist, album: e.album ?? null },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    songs.push({ id: song.id, spotifyId: song.spotifyId, albumSpotifyId: song.albumSpotifyId });
  }

  const previousChart = await prisma.chart.findFirst({
    where: { userId: chart.userId, weekIndex: { lt: chart.weekIndex } },
    include: { entries: true },
    orderBy: { weekIndex: "desc" },
  });

  const entryData = entries.map((e, i) => {
    const song = songs[i];
    const pos = i + 1;
    const points = 101 - pos;
    const prev = previousChart?.entries.find((pe) => pe.songId === song.id);
    const { palette, seed } = paletteFor(e.artist, e.title);

    if (!prev) {
      return {
        songId: song.id,
        songSpotifyId: song.spotifyId,
        albumSpotifyId: song.albumSpotifyId,
        points,
        position: pos,
        status: "new",
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

  await prisma.$transaction([
    prisma.chartEntry.deleteMany({ where: { chartId } }),
    prisma.chart.update({
      where: { id: chartId },
      data: {
        entries: { create: entryData },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
