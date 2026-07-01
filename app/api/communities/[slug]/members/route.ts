import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCommunityBySlug } from "@/lib/community-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
          lastfmUser: true,
        },
      },
    },
  });

  const postCounts = await prisma.post.groupBy({
    by: ["userId"],
    where: { communityId: community.id },
    _count: { id: true },
  });
  const postsByUser = new Map(postCounts.map((p) => [p.userId, p._count.id]));

  return NextResponse.json({
    members: members.map((m, i) => ({
      rank: i + 1,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      posts: postsByUser.get(m.userId) ?? 0,
      hasLastfm: Boolean(m.user.lastfmUser),
      user: {
        id: m.user.id,
        handle: m.user.handle,
        name: m.user.name,
        avatarColor: m.user.avatarColor,
        image: m.user.image,
      },
    })),
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const existing = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId: community.id } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  await prisma.$transaction([
    prisma.communityMember.create({
      data: { userId, communityId: community.id, role: "member" },
    }),
    prisma.community.update({
      where: { id: community.id },
      data: { members: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const member = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId: community.id } },
  });
  if (!member) {
    return NextResponse.json({ error: "Você não é membro." }, { status: 400 });
  }
  if (member.role === "owner") {
    return NextResponse.json({ error: "O dono não pode sair da comunidade." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.communityMember.delete({ where: { id: member.id } }),
    prisma.community.update({
      where: { id: community.id },
      data: { members: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
