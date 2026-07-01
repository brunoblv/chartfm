import { prisma } from "@/lib/prisma";

export type CommunityRole = "owner" | "admin" | "member";

export type CommunityMemberInfo = {
  userId: string;
  role: CommunityRole;
};

export async function getCommunityBySlug(slug: string) {
  return prisma.community.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      icon: true,
      logoUrl: true,
      coverA: true,
      coverB: true,
      coverImageUrl: true,
      members: true,
      posts: true,
      founded: true,
      ownerId: true,
      maxSongs: true,
      paradaName: true,
      memberPositionLimit: true,
      pointsMode: true,
      customPoints: true,
      isPublic: true,
      privacy: true,
      owner: { select: { id: true, name: true, handle: true } },
    },
  });
}

export async function getCommunityMemberRole(
  communityId: string,
  userId: string | undefined | null,
): Promise<CommunityRole | null> {
  if (!userId) return null;
  const row = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { role: true },
  });
  if (!row) return null;
  const role = row.role as CommunityRole;
  if (role === "owner" || role === "admin" || role === "member") return role;
  return "member";
}

export async function isCommunityAdmin(
  communityId: string,
  userId: string | undefined | null,
): Promise<boolean> {
  const role = await getCommunityMemberRole(communityId, userId);
  return role === "owner" || role === "admin";
}

export async function getCommunityMemberUserIds(communityId: string): Promise<string[]> {
  const rows = await prisma.communityMember.findMany({
    where: { communityId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
