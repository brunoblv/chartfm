import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { prisma } from "@/lib/prisma";
import { loadCommunityHeader } from "@/lib/community-page-data";
import { CommunityMembersList } from "./CommunityMembersList";

export default async function CommunityMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await prisma.community.findUnique({ where: { slug }, select: { id: true } });
  if (!row) notFound();

  const members = await prisma.communityMember.findMany({
    where: { communityId: row.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true, lastfmUser: true } },
    },
  });

  const postCounts = await prisma.post.groupBy({
    by: ["userId"],
    where: { communityId: row.id },
    _count: { id: true },
  });
  const postsByUser = new Map(postCounts.map((p) => [p.userId, p._count.id]));

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={community} activeTab="members" />
      <div style={{ padding: "28px 40px 80px 40px" }}>
        <CommunityMembersList
          members={members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            user: m.user,
            postCount: postsByUser.get(m.userId) ?? 0,
          }))}
        />
      </div>
    </Shell>
  );
}
