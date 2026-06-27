import { NextResponse } from "next/server";
import { requireSpotifySession } from "@/lib/mytrl-access-server";
import { prisma } from "@/lib/prisma";
import { getSpotifyRedirectUri, spotifyUserOAuthConfigured } from "@/lib/spotify-user";

export const runtime = "nodejs";

// GET /api/spotify/status — status da conexão Spotify do usuário autenticado
export async function GET() {
  const session = await requireSpotifySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      spotifyRefreshToken: true,
      spotifyNewHitsPlaylistId: true,
      spotifyUserId: true,
    },
  });

  const connected = Boolean(user?.spotifyRefreshToken);
  const playlistId = user?.spotifyNewHitsPlaylistId ?? null;

  return NextResponse.json({
    configured: spotifyUserOAuthConfigured(),
    redirectUri: getSpotifyRedirectUri(),
    connected,
    playlistFound: Boolean(playlistId),
    playlistId,
    spotifyUserId: user?.spotifyUserId ?? null,
  });
}
