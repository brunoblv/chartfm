import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string; clipId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clipId } = await params;
  const userId = session.user.id;

  const clip = await prisma.songVideoClip.findUnique({
    where: { id: clipId },
    select: { id: true, votes: true },
  });
  if (!clip) {
    return NextResponse.json({ error: "Clip não encontrado" }, { status: 404 });
  }

  const existing = await prisma.songVideoClipVote.findUnique({
    where: { clipId_userId: { clipId, userId } },
  });

  if (existing) {
    // remove vote
    await prisma.$transaction([
      prisma.songVideoClipVote.delete({ where: { id: existing.id } }),
      prisma.songVideoClip.update({
        where: { id: clipId },
        data: { votes: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json({ votes: clip.votes - 1, hasVoted: false });
  } else {
    // add vote
    await prisma.$transaction([
      prisma.songVideoClipVote.create({ data: { clipId, userId } }),
      prisma.songVideoClip.update({
        where: { id: clipId },
        data: { votes: { increment: 1 } },
      }),
    ]);
    return NextResponse.json({ votes: clip.votes + 1, hasVoted: true });
  }
}
