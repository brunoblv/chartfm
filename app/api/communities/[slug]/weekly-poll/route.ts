import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCommunityBySlug, getCommunityMemberRole } from "@/lib/community-auth";
import { getLatestCommunityWeeklyPollView } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

// GET /api/communities/[slug]/weekly-poll — enquete da comunidade (só membros veem detalhes para votar)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const role = userId ? await getCommunityMemberRole(community.id, userId) : null;
  const isMember = role != null;

  const poll = await getLatestCommunityWeeklyPollView(community.id, isMember ? userId : null);

  return NextResponse.json({
    poll,
    loggedIn: Boolean(userId),
    isMember,
    community: { slug: community.slug, name: community.name },
  });
}
