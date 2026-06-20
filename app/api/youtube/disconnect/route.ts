import { NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/youtube/disconnect
export async function POST() {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      youtubeAccessToken: null,
      youtubeRefreshToken: null,
      youtubeTokenExpiresAt: null,
      youtubeChannelId: null,
      youtubeChannelHandle: null,
    },
  });

  return NextResponse.json({ ok: true });
}
