import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { syncPushYouTubePlaylist } from "@/lib/youtube-user";

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
        include: {
          song: { select: { title: true, artist: true } },
        },
      },
    },
  });

  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });

  const tracks = round.submissions.map((s) => ({
    title: s.song.title,
    artist: s.song.artist,
  }));

  const result = await syncPushYouTubePlaylist({
    roundId: round.id,
    roundNumber: round.number,
    season: round.season,
    tracks,
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
    videoCount: result.videoCount,
    missingCount: result.missing.length,
    missing: result.missing.map((t) => `${t.artist} — ${t.title}`),
  });
}
