import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const [clips, myVotes, myChoice] = await Promise.all([
    prisma.songVideoClip.findMany({
      where: { songId },
      orderBy: { votes: "desc" },
      select: {
        id: true,
        imageUrl: true,
        votes: true,
        uploadedBy: true,
        uploader: { select: { name: true, handle: true } },
      },
    }),
    userId
      ? prisma.songVideoClipVote.findMany({
          where: { userId, clip: { songId } },
          select: { clipId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.userSongVideoClipChoice.findUnique({
          where: { userId_songId: { userId, songId } },
          select: { clipId: true },
        })
      : Promise.resolve(null),
  ]);

  const votedIds = new Set(myVotes.map((v) => v.clipId));

  const result = clips.map((c) => ({
    id: c.id,
    imageUrl: c.imageUrl,
    votes: c.votes,
    uploadedBy: c.uploadedBy,
    uploaderName: c.uploader.name,
    uploaderHandle: c.uploader.handle,
    hasVoted: votedIds.has(c.id),
    isMyChoice: myChoice?.clipId === c.id,
    isMyUpload: c.uploadedBy === userId,
  }));

  return NextResponse.json({ clips: result });
}
