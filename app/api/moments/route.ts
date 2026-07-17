import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getServerLocale } from "@/lib/i18n/server";
import { getMomentsFeed, isMomentType, type MomentsFeedScope } from "@/lib/moments-feed";
import { mapRecommendationRow, recommendationRowInclude } from "@/lib/recommendations-feed";
import { upsertSongFromSpotify } from "@/lib/mytrl-weekly-chart";
import { buildWeekIndexFromDate } from "@/lib/chart-week";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 1000;

/** Início do dia atual no horário de Brasília (regra da Indicação: 1 por dia). */
function startOfDayBRT(): Date {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  nowBRT.setUTCHours(0, 0, 0, 0);
  return new Date(nowBRT.getTime() + 3 * 60 * 60 * 1000);
}

/** weekIndex da semana ISO corrente em BRT — a semana que a próxima votação vai apurar. */
function currentWeekIndexBRT(): number {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const wall = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 12);
  return buildWeekIndexFromDate(wall);
}

/**
 * Indicação vira o Melhor da Semana (destaque) e Throwback vira o Flashback da parada
 * pessoal da semana corrente do usuário — mesmas condições de chart que a votação
 * semanal usa ao coletar indicações. Sem parada na semana, não faz nada.
 */
async function applyMomentToWeeklyChart(
  userId: string,
  songId: string,
  field: "destaqueSongId" | "flashbackSongId",
): Promise<void> {
  const chart = await prisma.chart.findFirst({
    where: {
      userId,
      weekIndex: currentWeekIndexBRT(),
      isPublished: true,
      communityId: null,
      parada: { deletedAt: null, isCommunityOfficial: false },
    },
    orderBy: { postedAt: "desc" },
    select: { id: true },
  });
  if (!chart) return;
  await prisma.chart.update({ where: { id: chart.id }, data: { [field]: songId } });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const locale = await getServerLocale();

  const params = req.nextUrl.searchParams;
  const scopeParam = params.get("scope");
  const scope: MomentsFeedScope = scopeParam === "following" ? "following" : "all";
  const typeParam = params.get("type");
  const type = typeParam && isMomentType(typeParam) ? typeParam : null;
  const cursor = params.get("cursor") || null;
  const limitParam = Number(params.get("limit") ?? 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 10;

  const page = await getMomentsFeed({
    viewerId: session?.user?.id ?? null,
    locale,
    scope,
    type,
    cursor,
    limit,
  });

  return NextResponse.json(page);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    type?: string;
    songId?: string;
    spotifyId?: string;
    title?: string;
    artist?: string;
    album?: string;
    text?: string;
    rating?: number;
  };

  const type = body.type?.trim() ?? "";
  if (!isMomentType(type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const text = body.text?.trim() || null;
  if (text && text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  let rating: number | null = null;
  if (type === "review") {
    if (
      typeof body.rating !== "number" ||
      !Number.isInteger(body.rating) ||
      body.rating < 0 ||
      body.rating > 10
    ) {
      return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
    }
    rating = body.rating;
  }

  if (type === "descobri") {
    const alreadyToday = await prisma.songRecommendation.count({
      where: {
        userId: session.user.id,
        type: "descobri",
        createdAt: { gte: startOfDayBRT() },
      },
    });
    if (alreadyToday > 0) {
      return NextResponse.json({ error: "daily_limit" }, { status: 429 });
    }
  }

  let songId = body.songId?.trim() || null;
  if (!songId && body.spotifyId?.trim()) {
    const resolved = await upsertSongFromSpotify(body.spotifyId.trim(), {
      track: body.title?.trim() || "Música",
      artist: body.artist?.trim() || "Artista",
      album: body.album?.trim() || "",
    });
    songId = resolved.id;
  }
  if (!songId) {
    return NextResponse.json({ error: "missing_song" }, { status: 400 });
  }

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) {
    return NextResponse.json({ error: "song_not_found" }, { status: 404 });
  }

  const moment = await prisma.songRecommendation.create({
    data: {
      userId: session.user.id,
      songId,
      type,
      rating,
      text,
    },
    include: recommendationRowInclude,
  });

  // Efeitos na parada da semana: Indicação → Melhor da Semana; Throwback → Flashback.
  if (type === "descobri") {
    await applyMomentToWeeklyChart(session.user.id, songId, "destaqueSongId");
  } else if (type === "throwback") {
    await applyMomentToWeeklyChart(session.user.id, songId, "flashbackSongId");
  }

  const locale = await getServerLocale();
  return NextResponse.json(mapRecommendationRow(moment, new Set<string>(), locale), {
    status: 201,
  });
}
