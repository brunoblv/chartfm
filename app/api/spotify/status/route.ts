import { NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { getMyTrlOwnerUser, spotifyUserOAuthConfigured } from "@/lib/spotify-user";

export const runtime = "nodejs";

// GET /api/spotify/status — status da conexão Spotify (somente @bruno)
export async function GET() {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const owner = await getMyTrlOwnerUser();
  const connected = Boolean(owner?.spotifyRefreshToken);
  const playlistId = owner?.spotifyNewHitsPlaylistId ?? null;

  return NextResponse.json({
    configured: spotifyUserOAuthConfigured(),
    connected,
    playlistFound: Boolean(playlistId),
    playlistId,
    spotifyUserId: owner?.spotifyUserId ?? null,
  });
}
