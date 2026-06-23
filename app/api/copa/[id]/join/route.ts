import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// POST /api/copa/[id]/join — current user signs themselves up
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const copa = await prisma.copaEdition.findUnique({
    where: { id },
    include: { _count: { select: { participants: true } } },
  });
  if (!copa) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (copa.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Registration not open" }, { status: 400 });
  }

  const existing = await prisma.copaParticipant.findUnique({
    where: { copaId_userId: { copaId: id, userId: session.user.id } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyJoined: true });
  }

  if (copa._count.participants >= copa.maxParticipants) {
    return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
  }

  const participant = await prisma.copaParticipant.create({
    data: { copaId: id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true, participant });
}

// DELETE /api/copa/[id]/join — current user withdraws during registration
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (copa.status !== "REGISTRATION") {
    return NextResponse.json({ error: "Cannot withdraw after registration" }, { status: 400 });
  }

  // Remove the user's claimed artists (and their singles via cascade) then the participation.
  await prisma.$transaction([
    prisma.copaArtist.deleteMany({ where: { copaId: id, ownerId: session.user.id } }),
    prisma.copaParticipant.deleteMany({ where: { copaId: id, userId: session.user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
