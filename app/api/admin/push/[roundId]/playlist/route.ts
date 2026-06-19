import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createSpotifyPlaylist, addTracksToSpotifyPlaylist, getSpotifyUserAccessToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { roundId: string } },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = params;

  const round = await prisma.pushRound.findUnique({
    where: { id: roundId },
    include: {
      submissions: {
        select: { spotifyTrackId: true },
      },
    },
  });

  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });

  const trackIds = round.submissions.map((s) => s.spotifyTrackId);
  if (trackIds.length === 0) {
    return NextResponse.json({ error: "Nenhuma música inscrita ainda" }, { status: 400 });
  }

  const token = await getSpotifyUserAccessToken(auth.userId);
  if (!token) {
    return NextResponse.json({ error: "Conta Spotify não conectada. Conecte nas configurações.", needsReconnect: true }, { status: 400 });
  }

  const playlistName = `ChartFM Push · Rodada ${round.number}${round.title ? ` · ${round.title}` : ""}`.slice(0, 100);
  const description = `Playlist do jogo Push — Temporada ${round.season} · Rodada ${round.number}`.slice(0, 300);

  const created = await createSpotifyPlaylist(token, playlistName, description, true);
  if (!created.ok) {
    return NextResponse.json({ error: created.message, needsReconnect: created.needsReconnect }, { status: 502 });
  }

  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const added = await addTracksToSpotifyPlaylist(token, created.id, uris);
  if (!added.ok) {
    return NextResponse.json({ error: added.message }, { status: 502 });
  }

  await prisma.pushRound.update({
    where: { id: roundId },
    data: { spotifyPlaylistId: created.id },
  });

  return NextResponse.json({ playlistId: created.id, playlistUrl: created.url });
}
