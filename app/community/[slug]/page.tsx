import { notFound } from "next/navigation";
import { communityImageSrc } from "@/lib/community-image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCommunityBySlug, isCommunityAdmin, getCommunityMemberRole } from "@/lib/community-auth";
import { computeCommunityChartData, parseCommunityPointsConfig } from "@/lib/community-chart";
import { buildCommunityContext } from "@/lib/entity-context-text";
import { formatWeekLabel, formatCommunityFoundedDate } from "@/lib/i18n/format";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { CommunityPageClient, type CommunityDbSerializable, type CommunityPostSerializable, type CommunityTopSongSerializable, type CommunityActiveMemberSerializable } from "./CommunityPageClient";

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { locale } = await getServerTranslations();
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const row = await getCommunityBySlug(slug);
  if (!row) notFound();

  const [postsRows, isAdmin, memberRole, openWeeklyPoll] = await Promise.all([
    prisma.post.findMany({
      where: { communityId: row.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
        postLikes: { where: { userId: userId ?? "" }, select: { id: true } },
        postReplies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
            replyTo: { select: { id: true, user: { select: { handle: true, name: true } } } },
            replyLikes: { where: { userId: userId ?? "" }, select: { id: true } },
          },
        },
      },
    }),
    isCommunityAdmin(row.id, userId),
    userId ? getCommunityMemberRole(row.id, userId) : Promise.resolve(null),
    prisma.weeklySpotlightPoll.findFirst({
      where: { status: "open", communityId: row.id },
      select: { weekLabel: true, dateRange: true },
      orderBy: { weekIndex: "desc" },
    }),
  ]);

  const config = parseCommunityPointsConfig(row);
  const chart = await computeCommunityChartData(row.id, config);

  const db: CommunityDbSerializable = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    icon: row.icon,
    logoUrl: communityImageSrc(row.slug, "logo", row.logoUrl),
    coverA: row.coverA,
    coverB: row.coverB,
    coverImageUrl: communityImageSrc(row.slug, "cover", row.coverImageUrl),
    members: row.members,
    posts: row.posts,
    founded: row.founded,
    createdAt: row.createdAt.toISOString(),
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
    hasLiked: post.postLikes.length > 0,
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
      hasLiked: reply.replyLikes.length > 0,
      replyToId: reply.replyToId,
      replyToUser: reply.replyTo
        ? { handle: reply.replyTo.user.handle, name: reply.replyTo.user.name }
        : null,
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

  const top5: CommunityTopSongSerializable[] = chart.weeklySongs.slice(0, 5).map((e) => ({
    position: e.position,
    id: e.song.id ?? null,
    title: e.song.title,
    artist: e.song.artist,
    slugArtist: e.song.slugArtist ?? null,
    spotifyId: e.song.spotifyId ?? null,
    artistSpotifyId: e.song.artistSpotifyId ?? null,
    artistRefId: e.song.artistRefId ?? null,
    cover: e.cover,
    status: e.status,
    delta: e.delta ?? null,
    weeks: e.weeks,
  }));

  // Tagline é uma "descrição curta" livre (frase sobre a comunidade), não necessariamente
  // um gênero/tema — evita usar como "theme" para não gerar frases estranhas com texto livre.
  const contextText = buildCommunityContext(
    {
      name: row.name,
      theme: null,
      memberCount: row.members,
      foundedLabel: formatCommunityFoundedDate(locale, row.createdAt.toISOString(), row.founded || ""),
      chartCount: chart.overallChartCount,
      topSong: top5[0] ? { title: top5[0].title, artist: top5[0].artist } : null,
      weekLabel: chart.weekLabel ? formatWeekLabel(locale, chart.weekLabel) : null,
    },
    locale,
  );

  const seenMemberIds = new Set<string>();
  const activeMembers: CommunityActiveMemberSerializable[] = [];
  for (const post of postsRows) {
    if (seenMemberIds.has(post.user.id)) continue;
    seenMemberIds.add(post.user.id);
    activeMembers.push({
      id: post.user.id,
      handle: post.user.handle,
      name: post.user.name,
      avatarColor: post.user.avatarColor,
      image: post.user.image,
    });
    if (activeMembers.length >= 8) break;
  }

  return (
    <CommunityPageClient
      dbCommunity={db}
      dbPosts={dbPosts}
      top5={top5}
      activeMembers={activeMembers}
      contributorCount={chart.contributorCount}
      dateRange={chart.dateRange}
      contextText={contextText}
      weeklyPollOpen={
        openWeeklyPoll
          ? { weekLabel: openWeeklyPoll.weekLabel, dateRange: openWeeklyPoll.dateRange }
          : null
      }
    />
  );
}
