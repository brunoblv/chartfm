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

// GET /api/admin/copa/[id]/squads — lista artistas e singles de todos os participantes
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [participants, artists, fixtures] = await Promise.all([
    prisma.copaParticipant.findMany({
      where: { copaId: id },
      include: { user: { select: { id: true, name: true, handle: true, avatarColor: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.copaArtist.findMany({
      where: { copaId: id },
      include: { singles: { orderBy: { slotIndex: "asc" } } },
      orderBy: [{ ownerId: "asc" }, { artistName: "asc" }],
    }),
    prisma.copaFixture.findMany({
      where: { copaId: id, status: { in: ["LIVE", "DONE"] } },
      select: { artistAId: true, artistBId: true, singleAIdx: true, singleBIdx: true },
    }),
  ]);

  function lockedSlots(artistId: string): number[] {
    const locked = new Set<number>();
    for (const f of fixtures) {
      if (f.artistAId === artistId) locked.add(f.singleAIdx);
      if (f.artistBId === artistId) locked.add(f.singleBIdx);
    }
    return [...locked];
  }

  const artistsByOwner = new Map<string, typeof artists>();
  for (const a of artists) {
    const list = artistsByOwner.get(a.ownerId) ?? [];
    list.push(a);
    artistsByOwner.set(a.ownerId, list);
  }

  const squads = participants.map((p) => {
    const pArtists = artistsByOwner.get(p.userId) ?? [];
    const singlesFilled = pArtists.reduce((n, a) => n + a.singles.length, 0);
    return {
      userId: p.userId,
      name: p.user.name,
      handle: p.user.handle,
      avatarColor: p.user.avatarColor,
      artistCount: pArtists.length,
      singlesFilled,
      artists: pArtists.map((a) => ({
        id: a.id,
        artistName: a.artistName,
        artistImage: a.artistImage,
        artistColor: a.artistColor,
        artistInitials: a.artistInitials,
        groupLetter: a.groupLetter,
        singles: a.singles.map((s) => ({
          slotIndex: s.slotIndex,
          songName: s.songName,
          songId: s.songId,
        })),
        lockedSlots: lockedSlots(a.id),
      })),
    };
  });

  return NextResponse.json({
    copaId: id,
    artistsPerUser: copa.artistsPerUser,
    squads,
  });
}
