import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// PUT /api/copa/[id]/singles
// body: { artistId, singles: [{slotIndex, songName, songId?}] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { artistId, singles } = body as {
    artistId: string;
    singles: { slotIndex: number; songName: string; songId?: string | null }[];
  };

  const artist = await prisma.copaArtist.findUnique({ where: { id: artistId } });
  if (!artist || artist.copaId !== id || artist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  // Upsert each single slot
  await Promise.all(
    singles.map((s) =>
      prisma.copaSingle.upsert({
        where: { copaArtistId_slotIndex: { copaArtistId: artistId, slotIndex: s.slotIndex } },
        create: {
          copaArtistId: artistId,
          slotIndex: s.slotIndex,
          songName: s.songName,
          songId: s.songId ?? null,
        },
        update: {
          songName: s.songName,
          songId: s.songId ?? null,
        },
      }),
    ),
  );

  const updated = await prisma.copaSingle.findMany({
    where: { copaArtistId: artistId },
    orderBy: { slotIndex: "asc" },
  });

  return NextResponse.json({ singles: updated });
}
