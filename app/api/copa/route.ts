import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, handle: true, avatarColor: true } },
        },
      },
    },
  });

  if (!copa) return NextResponse.json({ copa: null });

  const isParticipant = userId
    ? copa.participants.some((p) => p.userId === userId)
    : false;

  return NextResponse.json({
    copa: {
      id: copa.id,
      name: copa.name,
      year: copa.year,
      status: copa.status,
      maxParticipants: copa.maxParticipants,
      artistsPerUser: copa.artistsPerUser,
      isParticipant,
      participants: copa.participants.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        handle: p.user.handle,
        avatarColor: p.user.avatarColor,
      })),
    },
  });
}
