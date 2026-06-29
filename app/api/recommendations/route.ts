import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getRecommendationsFeed } from "@/lib/recommendations-feed";
import { getServerLocale } from "@/lib/i18n/server";
import { upsertSongFromSpotify } from "@/lib/mytrl-weekly-chart";
import { extractYouTubeId } from "@/lib/youtube-id";
import { fetchYouTubeOEmbed } from "@/lib/youtube-oembed";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const locale = await getServerLocale();
  const items = await getRecommendationsFeed(session?.user?.id ?? null, locale);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    songId?: string;
    spotifyId?: string;
    title?: string;
    artist?: string;
    album?: string;
    youtubeUrl?: string;
    text?: string;
  };

  const text = body.text?.trim() || null;
  if (text && text.length > 1000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const youtubeId = body.youtubeUrl?.trim() ? extractYouTubeId(body.youtubeUrl.trim()) : null;
  let songId = body.songId?.trim() || null;

  if (youtubeId) {
    if (songId || body.spotifyId?.trim()) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
  } else {
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

    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: { id: true },
    });
    if (!song) {
      return NextResponse.json({ error: "song_not_found" }, { status: 404 });
    }
  }

  const ytMeta = youtubeId ? await fetchYouTubeOEmbed(youtubeId) : null;

  const rec = await prisma.songRecommendation.create({
    data: {
      userId: session.user.id,
      songId: youtubeId ? null : songId,
      youtubeId,
      ytTitle: ytMeta?.title ?? (youtubeId ? "Vídeo do YouTube" : null),
      ytChannel: ytMeta?.channel ?? (youtubeId ? "YouTube" : null),
      text,
    },
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

  const locale = await getServerLocale();
  const [item] = await getRecommendationsFeed(session.user.id, locale, 1);
  if (item?.id === rec.id) {
    return NextResponse.json(item, { status: 201 });
  }

  return NextResponse.json(
    {
      id: rec.id,
      text: rec.text,
      likes: 0,
      comments: 0,
      liked: false,
      postedAgo: "agora",
      createdAt: rec.createdAt.toISOString(),
      kind: rec.youtubeId ? "youtube" : "song",
      user: {
        id: rec.user.id,
        handle: rec.user.handle,
        name: rec.user.name,
        avatar: rec.user.avatarColor,
        imageUrl: rec.user.image ?? null,
        verified: rec.user.verified,
      },
      song: rec.song
        ? {
            id: rec.song.id,
            title: rec.song.exhibitionName?.trim() || rec.song.title,
            artist:
              rec.song.artistRef?.exhibitionName?.trim() ||
              rec.song.artistRef?.name?.trim() ||
              rec.song.artist,
            album: rec.song.album ?? null,
            spotifyId: rec.song.spotifyId ?? null,
            artistSpotifyId: rec.song.artistSpotifyId ?? null,
            artistRefId: rec.song.artistRef?.id ?? null,
            coverUrl: rec.song.albumRef?.coverUrl?.trim() || null,
          }
        : null,
      youtube: rec.youtubeId
        ? {
            id: rec.youtubeId,
            title: rec.ytTitle,
            channel: rec.ytChannel,
          }
        : null,
    },
    { status: 201 },
  );
}
