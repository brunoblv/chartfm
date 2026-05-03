import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildPublicProfilePayload } from "@/lib/map-db-profile";
import { applyComputedEntryStatsToCharts } from "@/lib/chart-entry-stats";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const url = new URL(_req.url);
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }
  const mode = url.searchParams.get("mode") === "full" ? "full" : "summary";
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
        genres: true,
      },
    }),
  ]);

  if (!dbUserBase) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [totalCharts, charts, chartStatsHistory] = await Promise.all([
    prisma.chart.count({ where: { userId: dbUserBase.id } }),
    prisma.chart.findMany({
      where: { userId: dbUserBase.id },
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
                coverImageUrl: true,
                albumRef: { select: { coverUrl: true } },
                spotifyId: true,
                artistSpotifyId: true,
                artistRef: {
                  select: { name: true },
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
      where: { userId: dbUserBase.id },
      orderBy: { weekIndex: "asc" },
      select: {
        weekIndex: true,
        entries: {
          orderBy: { position: "asc" },
          select: { id: true, songId: true, position: true },
        },
      },
    }),
  ]);
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

  return NextResponse.json({
    ...buildPublicProfilePayload(dbUser, isFollowing),
    mode,
    page,
    perPage,
    totalCharts,
    artistImages,
    globalNumberOnes,
  });
}
