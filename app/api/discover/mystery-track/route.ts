import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getRankingWeekReference } from "@/lib/chart-week";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const rankingWeek = getRankingWeekReference(new Date());
  const where: Prisma.ChartEntryWhereInput = {
    chart: {
      isPublished: true,
      weekIndex: { gte: rankingWeek.weekIndex - 3 },
      parada: { autoDecay: false },
      ...(userId ? { userId: { not: userId } } : {}),
    },
  };

  const total = await prisma.chartEntry.count({ where });
  if (total === 0) {
    return NextResponse.json({ track: null });
  }

  const skip = Math.floor(Math.random() * total);
  const entry = await prisma.chartEntry.findFirst({
    where,
    skip,
    select: {
      coverPaletteA: true,
      coverPaletteB: true,
      song: {
        select: {
          title: true,
          artist: true,
          spotifyId: true,
          album: true,
          albumRef: { select: { coverUrl: true } },
          artistRef: { select: { name: true } },
        },
      },
      chart: {
        select: {
          userId: true,
          user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
        },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ track: null });
  }

  return NextResponse.json({
    track: {
      title: entry.song.title,
      artist: entry.song.artistRef?.name?.trim() || entry.song.artist,
      spotifyId: entry.song.spotifyId,
      coverUrl: entry.song.albumRef?.coverUrl?.trim() || null,
      palette: [entry.coverPaletteA, entry.coverPaletteB],
      publisher: entry.chart.user,
    },
  });
}
