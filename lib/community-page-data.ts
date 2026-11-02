import { getServerSession } from "next-auth";
import { communityImageSrc } from "@/lib/community-image";
import { authOptions } from "@/lib/auth-options";
import { getCommunityBySlug, isCommunityAdmin } from "@/lib/community-auth";
import type { CommunityHeaderData } from "@/components/community/CommunityHeader";

export async function loadCommunityHeader(slug: string): Promise<{
  community: CommunityHeaderData & { id: string };
  notFound: boolean;
}> {
  const row = await getCommunityBySlug(slug);
  if (!row) {
    return { community: null as never, notFound: true };
  }

  const session = await getServerSession(authOptions);
  const isAdmin = await isCommunityAdmin(row.id, session?.user?.id);

  return {
    notFound: false,
    community: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      cover: [row.coverA, row.coverB],
      coverImageUrl: communityImageSrc(row.slug, "cover", row.coverImageUrl),
      icon: row.icon,
      logoUrl: communityImageSrc(row.slug, "logo", row.logoUrl),
      members: row.members,
      posts: row.posts,
      founded: row.founded,
      createdAt: row.createdAt.toISOString(),
      adminName: row.owner?.name ?? "-",
      paradaName: row.paradaName,
      isAdmin,
    },
  };
}
