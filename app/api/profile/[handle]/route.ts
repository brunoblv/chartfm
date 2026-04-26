import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildPublicProfilePayload } from "@/lib/map-db-profile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const [session, dbUser] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findUnique({
      where: { handle },
      include: {
        charts: {
          orderBy: { weekIndex: "desc" },
          include: {
            entries: {
              orderBy: { position: "asc" },
              include: { song: true },
            },
          },
        },
      },
    }),
  ]);

  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let isFollowing = false;
  if (session?.user?.id && session.user.id !== dbUser.id) {
    const follow = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: dbUser.id } },
      select: { id: true },
    });
    isFollowing = Boolean(follow);
  }

  return NextResponse.json(buildPublicProfilePayload(dbUser, isFollowing));
}
