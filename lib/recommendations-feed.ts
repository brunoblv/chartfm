import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

export type RecommendationItem = {
  id: string;
  text: string | null;
  likes: number;
  comments: number;
  liked: boolean;
  postedAgo: string;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
    verified: boolean;
  };
  song: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    spotifyId: string | null;
    artistSpotifyId: string | null;
    artistRefId: number | null;
    coverUrl: string | null;
  };
};

export async function getRecommendationsFeed(
  viewerId: string | null,
  locale: Locale,
  limit = 30,
): Promise<RecommendationItem[]> {
  const rows = await prisma.songRecommendation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          verified: true,
        },
      },
      song: {
        select: {
          id: true,
          title: true,
          exhibitionName: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true, name: true, exhibitionName: true } },
          albumRef: { select: { coverUrl: true } },
        },
      },
    },
  });

  const likedSet = new Set<string>();
  if (viewerId && rows.length > 0) {
    const likes = await prisma.songRecommendationLike.findMany({
      where: {
        userId: viewerId,
        recommendationId: { in: rows.map((r) => r.id) },
      },
      select: { recommendationId: true },
    });
    for (const like of likes) likedSet.add(like.recommendationId);
  }

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    likes: r.likes,
    comments: r.comments,
    liked: likedSet.has(r.id),
    postedAgo: formatRelativeTime(locale, r.createdAt),
    createdAt: r.createdAt.toISOString(),
    user: {
      id: r.user.id,
      handle: r.user.handle,
      name: r.user.name,
      avatar: r.user.avatarColor,
      imageUrl: r.user.image ?? null,
      verified: r.user.verified,
    },
    song: {
      id: r.song.id,
      title: r.song.exhibitionName?.trim() || r.song.title,
      artist: r.song.artistRef?.exhibitionName?.trim() || r.song.artistRef?.name?.trim() || r.song.artist,
      album: r.song.album ?? null,
      spotifyId: r.song.spotifyId ?? null,
      artistSpotifyId: r.song.artistSpotifyId ?? null,
      artistRefId: r.song.artistRef?.id ?? null,
      coverUrl: r.song.albumRef?.coverUrl?.trim() || null,
    },
  }));
}
