import { NextRequest, NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { getSpotifyUserAccessToken, fetchSpotifyRecentlyPlayed, SpotifyAuthError } from "@/lib/spotify-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// POST /api/spotify/recent
// Body: { limit?: number } — busca as faixas tocadas recentemente no Spotify do usuário.
export async function POST(req: NextRequest) {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_CACHE });
  }

  const token = await getSpotifyUserAccessToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Conta Spotify não conectada. Conecte sua conta nas configurações de perfil." },
      { status: 400, headers: NO_CACHE },
    );
  }

  let body: { limit?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const limit =
    typeof body.limit === "number" && body.limit >= 10 && body.limit <= 50
      ? Math.round(body.limit)
      : 50;

  try {
    const recent = await fetchSpotifyRecentlyPlayed(token, limit);

    const songs = await Promise.all(
      recent.map(async (t) => {
        const dbSong = await prisma.song.findUnique({
          where: { spotifyId: t.spotifyId },
          select: {
            title: true,
            artist: true,
            album: true,
            spotifyId: true,
            albumRef: { select: { coverUrl: true } },
          },
        });
        if (dbSong) {
          return {
            title: dbSong.title,
            artist: dbSong.artist,
            album: dbSong.album ?? t.album,
            spotifyId: dbSong.spotifyId ?? t.spotifyId,
            imageUrl: dbSong.albumRef?.coverUrl ?? t.imageUrl,
          };
        }
        return {
          title: t.title,
          artist: t.artist,
          album: t.album,
          spotifyId: t.spotifyId,
          imageUrl: t.imageUrl,
        };
      }),
    );

    return NextResponse.json({ songs }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof SpotifyAuthError) {
      return NextResponse.json(
        { error: err.message, needsReconnect: true },
        { status: 400, headers: NO_CACHE },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível buscar suas músicas recentes do Spotify. Tente novamente." },
      { status: 502, headers: NO_CACHE },
    );
  }
}
