import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

export type RecommendationSong = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  artistRefId: number | null;
  coverUrl: string | null;
};

export type RecommendationYoutube = {
  id: string;
  title: string | null;
  channel: string | null;
};

export type RecommendationItem = {
  id: string;
  text: string | null;
  likes: number;
  comments: number;
  liked: boolean;
  postedAgo: string;
  createdAt: string;
  kind: "song" | "youtube";
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
    verified: boolean;
  };
  song: RecommendationSong | null;
  youtube: RecommendationYoutube | null;
};

export function recommendationDisplayTitle(rec: {
  song: { title: string; exhibitionName: string | null } | null;
  youtubeId: string | null;
  ytTitle: string | null;
}): string {
  if (rec.youtubeId) return rec.ytTitle?.trim() || "Vídeo do YouTube";
  return rec.song?.exhibitionName?.trim() || rec.song?.title || "Música";
}

function mapSong(song: {
  id: string;
  title: string;
  exhibitionName: string | null;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  artistRef: { id: number; name: string; exhibitionName: string | null } | null;
  albumRef: { coverUrl: string | null } | null;
}): RecommendationSong {
  return {
    id: song.id,
    title: song.exhibitionName?.trim() || song.title,
    artist: song.artistRef?.exhibitionName?.trim() || song.artistRef?.name?.trim() || song.artist,
    album: song.album ?? null,
    spotifyId: song.spotifyId ?? null,
    artistSpotifyId: song.artistSpotifyId ?? null,
    artistRefId: song.artistRef?.id ?? null,
    coverUrl: song.albumRef?.coverUrl?.trim() || null,
  };
}

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
    kind: r.youtubeId ? ("youtube" as const) : ("song" as const),
    user: {
      id: r.user.id,
      handle: r.user.handle,
      name: r.user.name,
      avatar: r.user.avatarColor,
      imageUrl: r.user.image ?? null,
      verified: r.user.verified,
    },
    song: r.song ? mapSong(r.song) : null,
    youtube: r.youtubeId
      ? {
          id: r.youtubeId,
          title: r.ytTitle,
          channel: r.ytChannel,
        }
      : null,
  }));
}
