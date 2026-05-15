import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ handle: string }> },
) {
  const url = new URL(_req.url);
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const type = url.searchParams.get("type") === "following" ? "following" : "followers";
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const perPageRaw = Number(url.searchParams.get("perPage") ?? "20");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const perPage = Number.isFinite(perPageRaw) && perPageRaw > 0 ? Math.min(50, Math.floor(perPageRaw)) : 20;

  const [session, targetUser] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    }),
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const userSelect = {
    id: true,
    handle: true,
    name: true,
    avatarColor: true,
    image: true,
    verified: true,
    followers: true,
    bio: true,
  } as const;

  const [users, total] = await Promise.all([
    type === "followers"
      ? prisma.userFollow.findMany({
          where: { followingId: targetUser.id },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          select: { follower: { select: userSelect } },
        }).then((rows) => rows.map((r) => r.follower))
      : prisma.userFollow.findMany({
          where: { followerId: targetUser.id },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          select: { following: { select: userSelect } },
        }).then((rows) => rows.map((r) => r.following)),
    type === "followers"
      ? prisma.userFollow.count({ where: { followingId: targetUser.id } })
      : prisma.userFollow.count({ where: { followerId: targetUser.id } }),
  ]);

  let followingSet = new Set<string>();
  if (session?.user?.id) {
    const myFollowing = await prisma.userFollow.findMany({
      where: {
        followerId: session.user.id,
        followingId: { in: users.map((u) => u.id) },
      },
      select: { followingId: true },
    });
    followingSet = new Set(myFollowing.map((f) => f.followingId));
  }

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      isFollowing: followingSet.has(u.id),
    })),
    total,
    page,
    perPage,
    hasMore: page * perPage < total,
  });
}
