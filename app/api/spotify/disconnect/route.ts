import { NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/spotify/disconnect — remove a conexão Spotify (somente @bruno)
export async function POST() {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyTokenExpiresAt: null,
      spotifyUserId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
