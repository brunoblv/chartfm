import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildPublicProfilePayload } from "@/lib/map-db-profile";
import { applyComputedEntryStatsToCharts } from "@/lib/chart-entry-stats";
import { ensureUserParadas } from "@/lib/paradas";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const url = new URL(_req.url);
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }
  const mode = url.searchParams.get("mode") === "full" ? "full" : "summary";
  const paradaIdParam = url.searchParams.get("paradaId")?.trim() || null;
  const yearParam = url.searchParams.get("year")?.trim() ?? "";
  const yearFilter = /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const perPageRaw = Number(url.searchParams.get("perPage") ?? "8");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const perPage = Number.isFinite(perPageRaw) && perPageRaw > 0 ? Math.min(50, Math.floor(perPageRaw)) : 8;

  const [session, dbUserBase] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findUnique({
      where: { handle },
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
        paradaNome: true,
        paradaLogo: true,
        genres: true,
        lastfmUser: true,
        twitterUser: true,
        instagramUser: true,
      },
    }),
  ]);

  if (!dbUserBase) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const paradas = await ensureUserParadas(prisma, dbUserBase.id);
  const activeParada =
    (paradaIdParam ? paradas.find((p) => p.id === paradaIdParam) : null) ??
    paradas.find((p) => p.isPrimary) ??
    paradas[0] ??
    null;

  const chartWhereBase = activeParada ? { paradaId: activeParada.id } : { userId: dbUserBase.id };
  const chartWhere =
    yearFilter != null
      ? {
          ...chartWhereBase,
          weekIndex: { gte: yearFilter * 100, lt: (yearFilter + 1) * 100 },
        }
      : chartWhereBase;

  const [totalCharts, charts, chartStatsHistory, weekIndexes] = await Promise.all([
    prisma.chart.count({ where: chartWhere }),
    prisma.chart.findMany({
      where: chartWhere,
      orderBy: { weekIndex: "desc" },
      ...(mode === "summary" ? { skip: (page - 1) * perPage, take: perPage } : {}),
      select: {
        id: true,
        weekIndex: true,
        weekLabel: true,
        dateRange: true,
        likes: true,
        comments: true,
        reposts: true,
        entries: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            songId: true,
            position: true,
            status: true,
            delta: true,
            prevPos: true,
            peak: true,
            weeks: true,
            coverPaletteA: true,
            coverPaletteB: true,
            coverSeed: true,
            song: {
              select: {
                id: true,
                title: true,
                exhibitionName: true,
                artist: true,
                album: true,
                albumRef: { select: { id: true, coverUrl: true } },
                spotifyId: true,
                artistSpotifyId: true,
                artistRef: {
                  select: { id: true, name: true },
                },
                feats: {
                  select: {
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
    }),
    prisma.chart.findMany({
      where: chartWhere,
      orderBy: { weekIndex: "asc" },
      select: {
        weekIndex: true,
        entries: {
          orderBy: { position: "asc" },
          select: { id: true, songId: true, position: true },
        },
      },
    }),
    prisma.chart.findMany({
      where: chartWhereBase,
      select: { weekIndex: true },
    }),
  ]);
  const chartYears = [...new Set(weekIndexes.map((c) => Math.floor(c.weekIndex / 100)))].sort((a, b) => b - a);
  const statsByEntryId = new Map(
    applyComputedEntryStatsToCharts(chartStatsHistory).flatMap((chart) =>
      chart.entries.map((entry) => [entry.id, entry] as const),
    ),
  );
  const computedCharts = charts.map((chart) => ({
    ...chart,
    entries: chart.entries.map((entry) => {
      const stats = statsByEntryId.get(entry.id);
      return stats
        ? {
            ...entry,
            status: stats.status,
            delta: stats.delta,
            prevPos: stats.prevPos,
            peak: stats.peak,
            weeks: stats.weeks,
          }
        : entry;
    }),
  }));
  const dbUser = { ...dbUserBase, charts: computedCharts };

  let isFollowing = false;
  if (session?.user?.id && session.user.id !== dbUserBase.id) {
    const follow = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: dbUserBase.id } },
      select: { id: true },
    });
    isFollowing = Boolean(follow);
  }

  const artistNames = [...new Set(dbUser.charts.flatMap((c) => c.entries.map((e) => e.song.artist)))];
  const artistRows = artistNames.length
    ? await prisma.artist.findMany({
        where: { name: { in: artistNames } },
        select: { name: true, imageUrl: true },
      })
    : [];
  const artistImages: Record<string, string | null> = Object.fromEntries(artistRows.map((a) => [a.name, a.imageUrl]));

  const songIds = [...new Set(dbUser.charts.flatMap((c) => c.entries.map((e) => e.songId)))];
  const songKeyById = new Map<string, string>();
  for (const chart of dbUser.charts) {
    for (const entry of chart.entries) {
      const displayTitle = entry.song.exhibitionName?.trim() || entry.song.title;
      songKeyById.set(entry.songId, `${displayTitle}\0${entry.song.artist}`);
    }
  }

  let globalNumberOnes: Record<string, number> = {};
  if (songIds.length > 0) {
    const ones = await prisma.chartEntry.findMany({
      where: {
        position: 1,
        songId: { in: songIds },
      },
      select: { songId: true },
    });
    for (const entry of ones) {
      const key = songKeyById.get(entry.songId);
      if (!key) continue;
      globalNumberOnes[key] = (globalNumberOnes[key] ?? 0) + 1;
    }
  }

  const paradaNome = activeParada?.name ?? dbUserBase.paradaNome;
  const genres = activeParada?.genres ?? dbUserBase.genres ?? [];

  return NextResponse.json({
    ...buildPublicProfilePayload(dbUser, isFollowing),
    paradaNome,
    genres,
    paradas: paradas.map((p) => ({
      id: p.id,
      name: p.name,
      logo: p.logo,
      genres: p.genres,
      isPrimary: p.isPrimary,
      sortOrder: p.sortOrder,
    })),
    activeParadaId: activeParada?.id ?? null,
    scoringTier: activeParada?.isPrimary === false ? "secondary" : "primary",
    mode,
    page,
    perPage,
    totalCharts,
    chartYears,
    filterYear: yearFilter,
    artistImages,
    globalNumberOnes,
  });
}
