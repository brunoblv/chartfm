import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

// PUT /api/admin/copa/[id]/singles — corrige singles de qualquer participante
// body: { artistId, slotIndex, songName, songId? }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { artistId, slotIndex, songName, songId } = body as {
    artistId: string;
    slotIndex: number;
    songName: string;
    songId?: string | null;
  };

  if (!artistId || slotIndex == null || !songName?.trim()) {
    return NextResponse.json({ error: "artistId, slotIndex e songName são obrigatórios" }, { status: 400 });
  }
  if (slotIndex < 0 || slotIndex > 6) {
    return NextResponse.json({ error: "slotIndex inválido" }, { status: 400 });
  }

  const artist = await prisma.copaArtist.findUnique({ where: { id: artistId } });
  if (!artist || artist.copaId !== id) {
    return NextResponse.json({ error: "Artista não encontrado" }, { status: 404 });
  }

  const single = await prisma.copaSingle.upsert({
    where: { copaArtistId_slotIndex: { copaArtistId: artistId, slotIndex } },
    create: {
      copaArtistId: artistId,
      slotIndex,
      songName: songName.trim(),
      songId: songId ?? null,
    },
    update: {
      songName: songName.trim(),
      songId: songId ?? null,
    },
  });

  return NextResponse.json({ single });
}
