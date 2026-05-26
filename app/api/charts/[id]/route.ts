import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { lastfmWeekPickerValueFromChart } from "@/lib/chart-week";
import { mapPrismaChartDetail } from "@/lib/map-db-profile";
import { recomputePersistedChartEntryStats } from "@/lib/chart-entry-stats";
import { getSpotifyArtistById, getSpotifyTrackMetadataById } from "@/lib/spotify-server";
import type { PersonalDropoutEntry } from "@/lib/types";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";

export const runtime = "nodejs";
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

  const currentSongIds = [...new Set(row.entries.map((e) => e.songId))];
  const songIdToKey = new Map(
    row.entries.map((e) => [e.songId, `${e.song.exhibitionName?.trim() || e.song.title}\0${e.song.artist}`]),
  );
  const [previousChartFull, nextChart] = await Promise.all([
    prisma.chart.findFirst({
      where: { paradaId: row.paradaId, weekIndex: { lt: row.weekIndex } },
      orderBy: { weekIndex: "desc" },
      include: {
        entries: {
          orderBy: { position: "asc" },
          include: {
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

  const [historyAgg, personalOnesAgg, globalOnesAgg, prevPositionsRaw] = await Promise.all([
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
    const key = songIdToKey.get(songId);
    if (key) personalNumberOnes[key] = total;
  }

  const globalNumberOnes: Record<string, number> = {};
  for (const [songId, total] of globalOnesBySong.entries()) {
    const key = songIdToKey.get(songId);
    if (key) globalNumberOnes[key] = total;
  }

  const entriesWithComputedStats = row.entries.map((entry) => {
    const hist = historyBySong.get(entry.songId);
    const weeks = hist?.weeks ?? 1;
    const peak = hist?.peak ?? entry.position;
    const expectedPrevWeek = prevWeekIndex(row.weekIndex);
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
    .filter((e) => !currentSongIdSet.has(e.songId))
    .sort((a, b) => a.position - b.position)
    .map((e) => {
      const img = e.song.albumRef?.coverUrl?.trim() || null;
      return {
        lastPos: e.position,
        song: {
          id: e.song.id,
          title: e.song.exhibitionName?.trim() || e.song.title,
          artist: e.song.artistRef?.name?.trim() || e.song.artist,
          slugArtist: e.song.artist,
          featArtists: (e.song.feats ?? []).map((f) => f.artist.name),
          album: e.song.album ?? "",
          spotifyId: e.song.spotifyId ?? null,
          artistSpotifyId: e.song.artistSpotifyId ?? null,
          artistRefId: e.song.artistRef?.id ?? null,
          albumRefId: e.song.albumRef?.id ?? null,
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
      dropouts,
    },
    { headers: NO_CACHE_HEADERS },
  );
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
  if (entries.length > 100) entries.splice(100);

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
  const scoringTier = scoringTierFromPrimary(chart.parada.isPrimary);
  const chartSize = entries.length;

  const songs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];
  const spotifyArtistCache = new Map<string, Awaited<ReturnType<typeof getSpotifyArtistById>>>();

  async function spotifyArtistProfile(spotifyId: string) {
    if (spotifyArtistCache.has(spotifyId)) return spotifyArtistCache.get(spotifyId)!;
    const profile = await getSpotifyArtistById(spotifyId);
    spotifyArtistCache.set(spotifyId, profile);
    return profile;
  }

  for (const e of entries) {
    const title = e.title?.trim();
    const artist = e.artist?.trim();
    if (!title || !artist) {
      return NextResponse.json({ error: "Entrada inválida: título e artista são obrigatórios" }, { status: 400 });
    }
    const spotifyId = e.spotifyId?.trim() || null;
    if (spotifyId) {
      const metadata = await getSpotifyTrackMetadataById(spotifyId);
      const primaryArtist = metadata?.primaryArtist;
      const albumSpotifyId = metadata?.album.spotifyId ?? null;
      const resolvedTitle = metadata?.title ?? title;
      const mainArtistName = primaryArtist?.name?.trim() || metadata?.artists?.[0]?.name?.trim() || artist;

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
            title: metadata?.album.title ?? e.album ?? "Album",
            artistSpotifyId: primaryArtist.spotifyId,
            albumType: metadata?.album.albumType ?? undefined,
            releaseDate: metadata?.album.releaseDate ?? undefined,
            coverUrl: metadata?.album.coverUrl ?? undefined,
            spotifyUrl: metadata?.album.spotifyUrl ?? undefined,
            totalTracks: metadata?.album.totalTracks ?? undefined,
          },
          create: {
            spotifyId: albumSpotifyId,
            title: metadata?.album.title ?? e.album ?? "Album",
            artistSpotifyId: primaryArtist.spotifyId,
            albumType: metadata?.album.albumType ?? undefined,
            releaseDate: metadata?.album.releaseDate ?? undefined,
            coverUrl: metadata?.album.coverUrl ?? null,
            spotifyUrl: metadata?.album.spotifyUrl ?? null,
            totalTracks: metadata?.album.totalTracks ?? null,
          },
        });
      }

      // A song may have been created manually (no spotifyId) with the same title+artist.
      // Upserting by spotifyId would try to CREATE a new record and hit the (title, artist) unique constraint.
      // Promote the existing record instead.
      const existingByName = await prisma.song.findFirst({
        where: { title: resolvedTitle, artist: mainArtistName },
        select: { id: true, spotifyId: true, albumSpotifyId: true },
      });
      if (existingByName) {
        const song = await prisma.song.update({
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
          select: { id: true, spotifyId: true, albumSpotifyId: true },
        });
        songs.push({ id: song.id, spotifyId: song.spotifyId ?? null, albumSpotifyId: song.albumSpotifyId ?? null });
        continue;
      }
      const song = await prisma.song.upsert({
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
    where: { paradaId: chart.paradaId, weekIndex: prevWeekIndex(chart.weekIndex) },
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
    const pos = i + 1;
    const points = pointsForChartPosition(pos, scoringTier, chartSize);
    const prev = previousChart?.entries.find((pe) => pe.songId === song.id);
    const { palette, seed } = paletteFor(e.artist, e.title);

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

  await prisma.$transaction([
    prisma.chartEntry.deleteMany({ where: { chartId } }),
    prisma.chart.update({
      where: { id: chartId },
      data: {
        entries: { create: entryData },
      },
    }),
  ]);
  await recomputePersistedChartEntryStats(prisma, chart.userId, chart.weekIndex);

  return NextResponse.json({ ok: true });
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
