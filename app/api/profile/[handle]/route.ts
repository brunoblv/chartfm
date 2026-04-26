import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildPublicProfilePayload } from "@/lib/map-db-profile";
import { searchSpotifyArtist, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const [session, dbUser] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findUnique({
      where: { handle },
      include: {
        charts: {
          orderBy: { weekIndex: "desc" },
          include: {
            entries: {
              orderBy: { position: "asc" },
              include: { song: true },
            },
          },
        },
      },
    }),
  ]);

  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let isFollowing = false;
  if (session?.user?.id && session.user.id !== dbUser.id) {
    const follow = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: dbUser.id } },
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

  if (spotifyConfigured()) {
    const missing = artistNames.filter((n) => !artistImages[n]);
    const CHUNK = 8;
    for (let i = 0; i < missing.length; i += CHUNK) {
      await Promise.all(
        missing.slice(i, i + CHUNK).map(async (name) => {
          const result = await searchSpotifyArtist(name);
          artistImages[name] = result?.imageUrl ?? null;
          if (result) {
            await prisma.artist.upsert({
              where: { spotifyId: result.spotifyId },
              create: {
                spotifyId: result.spotifyId,
                name: result.name,
                imageUrl: result.imageUrl,
                spotifyUrl: result.spotifyUrl,
              },
              update: {
                name: result.name,
                spotifyUrl: result.spotifyUrl ?? undefined,
                ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
              },
            });
          }
        })
      );
    }
  }

  return NextResponse.json({
    ...buildPublicProfilePayload(dbUser, isFollowing),
    artistImages,
  });
}
