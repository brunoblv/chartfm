import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SpotlightCategory } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

// GET /api/weekly-poll/prior-winner?category=destaque&songId=...&spotifyId=...
// Verifica se uma música já venceu essa categoria da Votação da Semana antes
// (usado para avisar no picker de Destaque/Flashback que ela não vai para a enquete de novo).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const songId = searchParams.get("songId");
  const spotifyId = searchParams.get("spotifyId");

  if (category !== "destaque" && category !== "flashback") {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  if (!songId && !spotifyId) {
    return NextResponse.json({ wonBefore: false });
  }

  const resolvedSongId =
    songId ??
    (
      await prisma.song.findUnique({
        where: { spotifyId: spotifyId! },
        select: { id: true },
      })
    )?.id ??
    null;

  if (!resolvedSongId) {
    return NextResponse.json({ wonBefore: false });
  }

  const won = await prisma.weeklySpotlightOption.findFirst({
    where: { songId: resolvedSongId, category: category as SpotlightCategory, isWinner: true },
    select: { id: true },
  });

  return NextResponse.json({ wonBefore: Boolean(won) });
}
