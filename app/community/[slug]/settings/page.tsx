import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadCommunityHeader } from "@/lib/community-page-data";
import { getCommunityBySlug } from "@/lib/community-auth";
import { CommunitySettingsClient } from "./CommunitySettingsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function parseCustomPoints(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

export default async function CommunitySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  if (!community.isAdmin) {
    redirect(`/community/${slug}`);
  }

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const members = await prisma.communityMember.findMany({
    where: { communityId: row.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
    },
  });

  return (
    <CommunitySettingsClient
      community={community}
      initial={{
        paradaName: row.paradaName,
        maxSongs: row.maxSongs,
        memberPositionLimit: row.memberPositionLimit,
        pointsMode: row.pointsMode,
        customPoints: parseCustomPoints(row.customPoints),
        name: row.name,
        tagline: row.tagline,
        logoUrl: row.logoUrl,
        coverA: row.coverA,
        coverB: row.coverB,
        coverImageUrl: row.coverImageUrl,
        icon: row.icon,
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        })),
      }}
    />
  );
}
