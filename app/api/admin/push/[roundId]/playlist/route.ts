import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { syncPushSpotifyPlaylist } from "@/lib/push-playlist-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;

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
  const result = await syncPushSpotifyPlaylist({
    roundId: round.id,
    roundNumber: round.number,
    season: round.season,
    trackIds,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, needsReconnect: result.needsReconnect },
      { status: result.needsReconnect ? 400 : 502 },
    );
  }

  return NextResponse.json({
    playlistId: result.playlistId,
    playlistUrl: result.playlistUrl,
  });
}
