import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { COMMUNITIES } from "@/lib/data";
import { isCommunityAdmin, getCommunityMemberRole } from "@/lib/community-auth";
import { CommunityPageClient, type CommunityDbSerializable, type CommunityPostSerializable } from "./CommunityPageClient";

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const row = await prisma.community.findUnique({
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
      paradaName: true,
      owner: { select: { name: true, handle: true } },
    },
  });

  if (row) {
    const [postsRows, isAdmin, memberRole] = await Promise.all([
      prisma.post.findMany({
        where: { communityId: row.id },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
          postReplies: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
            },
          },
        },
      }),
      isCommunityAdmin(row.id, userId),
      userId ? getCommunityMemberRole(row.id, userId) : Promise.resolve(null),
    ]);

    const db: CommunityDbSerializable = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      icon: row.icon,
      logoUrl: row.logoUrl,
      coverA: row.coverA,
      coverB: row.coverB,
      coverImageUrl: row.coverImageUrl,
      members: row.members,
      posts: row.posts,
      founded: row.founded,
      ownerName: row.owner?.name ?? null,
      ownerHandle: row.owner?.handle ?? null,
      paradaName: row.paradaName,
      isAdmin,
      isMember: memberRole != null,
    };
    const dbPosts: CommunityPostSerializable[] = postsRows.map((post) => ({
      id: post.id,
      kind: post.kind as "text" | "image" | "youtube",
      text: post.text,
      imageUrl: post.imageUrl,
      imageCaption: post.imageCaption,
      youtubeId: post.youtubeId,
      ytTitle: post.ytTitle,
      ytChannel: post.ytChannel,
      ytThumbA: post.ytThumbA,
      ytThumbB: post.ytThumbB,
      likes: post.likes,
      replies: post.replies,
      shares: post.shares,
      createdAt: post.createdAt.toISOString(),
      user: {
        id: post.user.id,
        handle: post.user.handle,
        name: post.user.name,
        avatarColor: post.user.avatarColor,
        image: post.user.image,
      },
      repliesList: post.postReplies.map((reply) => ({
        id: reply.id,
        text: reply.text,
        likes: reply.likes,
        createdAt: reply.createdAt.toISOString(),
        user: {
          id: reply.user.id,
          handle: reply.user.handle,
          name: reply.user.name,
          avatarColor: reply.user.avatarColor,
          image: reply.user.image,
        },
      })),
    }));
    return <CommunityPageClient dbCommunity={db} mockCommunity={null} dbPosts={dbPosts} />;
  }

  const mock = COMMUNITIES.find((c) => c.slug === slug);
  if (mock) {
    return <CommunityPageClient dbCommunity={null} mockCommunity={mock} dbPosts={[]} />;
  }

  notFound();
}
