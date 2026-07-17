import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import {
  mapRecommendationRow,
  recommendationRowInclude,
  type RecommendationItem,
} from "@/lib/recommendations-feed";

/** Tipos de Momento Musical que o usuário pode publicar no hub do Discover. */
export const MOMENT_TYPES = [
  "loop",
  "descobri",
  "recomendo",
  "lancamento",
  "review",
  "throwback",
] as const;

export type MomentType = (typeof MOMENT_TYPES)[number];

export function isMomentType(value: string): value is MomentType {
  return (MOMENT_TYPES as readonly string[]).includes(value);
}

export type MomentsFeedScope = "all" | "following";

export type MomentsFeedPage = {
  items: RecommendationItem[];
  nextCursor: string | null;
};

/**
 * Feed de Momentos Musicais (todos os tipos), com paginação por cursor.
 * scope "following" restringe a pessoas que o viewer segue.
 */
export async function getMomentsFeed(opts: {
  viewerId: string | null;
  locale: Locale;
  scope?: MomentsFeedScope;
  type?: MomentType | null;
  cursor?: string | null;
  limit?: number;
}): Promise<MomentsFeedPage> {
  const { viewerId, locale } = opts;
  const scope = opts.scope ?? "all";
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 30);

  let userFilter: { userId: { in: string[] } } | undefined;
  if (scope === "following") {
    if (!viewerId) return { items: [], nextCursor: null };
    const follows = await prisma.userFollow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    if (follows.length === 0) return { items: [], nextCursor: null };
    userFilter = { userId: { in: follows.map((f) => f.followingId) } };
  }

  const rows = await prisma.songRecommendation.findMany({
    where: {
      ...(userFilter ?? {}),
      ...(opts.type ? { type: opts.type } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: recommendationRowInclude,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const likedSet = new Set<string>();
  if (viewerId && pageRows.length > 0) {
    const likes = await prisma.songRecommendationLike.findMany({
      where: { userId: viewerId, recommendationId: { in: pageRows.map((r) => r.id) } },
      select: { recommendationId: true },
    });
    for (const like of likes) likedSet.add(like.recommendationId);
  }

  return {
    items: pageRows.map((r) => mapRecommendationRow(r, likedSet, locale)),
    nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
  };
}

/** Momento automático do sistema: grande subida/queda numa parada pessoal publicada. */
export type AutoMomentItem = {
  id: string;
  type: "subiu" | "caiu";
  delta: number;
  position: number;
  weekLabel: string;
  chartId: string;
  postedAgo: string;
  createdAt: string;
  user: {
    handle: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
  };
  song: {
    id: string;
    title: string;
    artist: string;
    spotifyId: string | null;
    artistRefId: number | null;
    coverUrl: string | null;
  };
};

const AUTO_MIN_DELTA = 5;
const AUTO_MAX_POSITION = 10;
const AUTO_WINDOW_DAYS = 7;

/**
 * Cards automáticos gerados na leitura (sem linhas no banco): grandes movimentos
 * no top 10 de paradas pessoais publicadas nos últimos dias. Máximo 1 por usuário.
 */
export async function getAutoMoments(locale: Locale, limit = 4): Promise<AutoMomentItem[]> {
  const cutoff = new Date(Date.now() - AUTO_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const entries = await prisma.chartEntry.findMany({
    where: {
      position: { lte: AUTO_MAX_POSITION },
      delta: { not: null },
      OR: [{ delta: { gte: AUTO_MIN_DELTA } }, { delta: { lte: -AUTO_MIN_DELTA } }],
      chart: {
        isPublished: true,
        communityId: null,
        postedAt: { gte: cutoff },
      },
    },
    select: {
      id: true,
      position: true,
      delta: true,
      chart: {
        select: {
          id: true,
          weekLabel: true,
          postedAt: true,
          user: { select: { handle: true, name: true, avatarColor: true, image: true } },
        },
      },
      song: {
        select: {
          id: true,
          title: true,
          exhibitionName: true,
          artist: true,
          spotifyId: true,
          artistRef: { select: { id: true, name: true, exhibitionName: true } },
          albumRef: { select: { coverUrl: true } },
        },
      },
    },
    orderBy: [{ chart: { postedAt: "desc" } }],
    take: 60,
  });

  const seenUsers = new Set<string>();
  const picked: AutoMomentItem[] = [];

  const sorted = entries.sort(
    (a, b) =>
      b.chart.postedAt.getTime() - a.chart.postedAt.getTime() ||
      Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0),
  );

  for (const entry of sorted) {
    if (picked.length >= limit) break;
    const delta = entry.delta ?? 0;
    if (delta === 0) continue;
    const userKey = entry.chart.user.handle;
    if (seenUsers.has(userKey)) continue;
    seenUsers.add(userKey);

    picked.push({
      id: `auto:${entry.id}`,
      type: delta > 0 ? "subiu" : "caiu",
      delta: Math.abs(delta),
      position: entry.position,
      weekLabel: entry.chart.weekLabel,
      chartId: entry.chart.id,
      postedAgo: formatRelativeTime(locale, entry.chart.postedAt),
      createdAt: entry.chart.postedAt.toISOString(),
      user: {
        handle: entry.chart.user.handle,
        name: entry.chart.user.name,
        avatar: entry.chart.user.avatarColor,
        imageUrl: entry.chart.user.image ?? null,
      },
      song: {
        id: entry.song.id,
        title: entry.song.exhibitionName?.trim() || entry.song.title,
        artist:
          entry.song.artistRef?.exhibitionName?.trim() ||
          entry.song.artistRef?.name?.trim() ||
          entry.song.artist,
        spotifyId: entry.song.spotifyId ?? null,
        artistRefId: entry.song.artistRef?.id ?? null,
        coverUrl: entry.song.albumRef?.coverUrl?.trim() || null,
      },
    });
  }

  return picked;
}
