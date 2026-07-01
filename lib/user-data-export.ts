import type { PrismaClient } from "@prisma/client";

const ACCOUNT_SELECT = {
  id: true,
  handle: true,
  name: true,
  email: true,
  image: true,
  googleId: true,
  emailVerifiedAt: true,
  avatarColor: true,
  bio: true,
  followers: true,
  following: true,
  streak: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
  paradaNome: true,
  genres: true,
  role: true,
  lastfmUser: true,
  twitterUser: true,
  instagramUser: true,
  chartSize: true,
  paradaLogo: true,
  spotifyUserId: true,
  spotifyTokenExpiresAt: true,
  spotifyNewHitsPlaylistId: true,
  youtubeChannelId: true,
  youtubeChannelHandle: true,
  youtubeTokenExpiresAt: true,
  spotifyRefreshToken: true,
  youtubeRefreshToken: true,
  passwordHash: true,
} as const;

export async function buildUserDataExport(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_SELECT,
  });

  if (!user) return null;

  const {
    passwordHash,
    spotifyRefreshToken,
    youtubeRefreshToken,
    ...accountFields
  } = user;

  const [
    paradas,
    charts,
    chartLikes,
    chartReposts,
    comments,
    commentLikes,
    commentReplies,
    posts,
    postLikes,
    postReplies,
    communityMemberships,
    ownedCommunities,
    followerLinks,
    followingLinks,
    notificationsReceived,
    notificationsSent,
    albumReviews,
    albumReviewHelpful,
    uploadedVideoClips,
    videoClipVotes,
    videoClipChoices,
    albumClubNominations,
    albumClubPollVotes,
    pushSubmissions,
    pushVotes,
    songRecommendations,
    songRecommendationLikes,
    songRecommendationComments,
    songRecommendationCommentLikes,
    songRecommendationCommentReplies,
    copaParticipations,
    copaArtists,
    copaVotes,
    supportTickets,
  ] = await Promise.all([
    prisma.parada.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.chart.findMany({
      where: { userId },
      orderBy: [{ weekIndex: "desc" }],
      include: {
        entries: {
          orderBy: { position: "asc" },
          include: {
            song: { select: { title: true, artist: true, spotifyId: true, album: true } },
          },
        },
      },
    }),
    prisma.chartLike.findMany({
      where: { userId },
      include: { chart: { select: { id: true, weekLabel: true, slug: true } } },
    }),
    prisma.chartRepost.findMany({
      where: { userId },
      include: { chart: { select: { id: true, weekLabel: true, slug: true } } },
    }),
    prisma.comment.findMany({
      where: { userId },
      include: { chart: { select: { id: true, weekLabel: true, slug: true } } },
    }),
    prisma.commentLike.findMany({
      where: { userId },
      include: { comment: { select: { id: true, text: true, chartId: true } } },
    }),
    prisma.commentReply.findMany({
      where: { userId },
      include: { comment: { select: { id: true, text: true, chartId: true } } },
    }),
    prisma.post.findMany({
      where: { userId },
      include: { community: { select: { slug: true, name: true } } },
    }),
    prisma.postLike.findMany({
      where: { userId },
      include: { post: { select: { id: true, text: true, communityId: true } } },
    }),
    prisma.postReply.findMany({
      where: { userId },
      include: { post: { select: { id: true, text: true, communityId: true } } },
    }),
    prisma.communityMember.findMany({
      where: { userId },
      include: { community: { select: { slug: true, name: true } } },
    }),
    prisma.community.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        privacy: true,
        isPublic: true,
        createdAt: true,
      },
    }),
    prisma.userFollow.findMany({
      where: { followerId: userId },
      include: { following: { select: { handle: true, name: true } } },
    }),
    prisma.userFollow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { handle: true, name: true } } },
    }),
    prisma.notification.findMany({ where: { recipientId: userId }, orderBy: { createdAt: "desc" } }),
    prisma.notification.findMany({ where: { actorId: userId }, orderBy: { createdAt: "desc" } }),
    prisma.albumReview.findMany({
      where: { userId },
      include: { album: { select: { title: true, spotifyId: true } } },
    }),
    prisma.albumReviewHelpful.findMany({
      where: { userId },
      include: { review: { select: { id: true, rating: true, body: true } } },
    }),
    prisma.songVideoClip.findMany({ where: { uploadedBy: userId } }),
    prisma.songVideoClipVote.findMany({ where: { userId } }),
    prisma.userSongVideoClipChoice.findMany({ where: { userId } }),
    prisma.albumClubNomination.findMany({
      where: { userId },
      include: { album: { select: { title: true, spotifyId: true } }, round: { select: { number: true, theme: true } } },
    }),
    prisma.albumClubPollVote.findMany({
      where: { userId },
      include: { round: { select: { number: true, theme: true } } },
    }),
    prisma.pushSubmission.findMany({
      where: { userId },
      include: { song: { select: { title: true, artist: true, spotifyId: true } }, round: { select: { number: true, title: true } } },
    }),
    prisma.pushVote.findMany({
      where: { userId },
      include: { round: { select: { number: true, title: true } } },
    }),
    prisma.songRecommendation.findMany({ where: { userId } }),
    prisma.songRecommendationLike.findMany({ where: { userId } }),
    prisma.songRecommendationComment.findMany({ where: { userId } }),
    prisma.songRecommendationCommentLike.findMany({ where: { userId } }),
    prisma.songRecommendationCommentReply.findMany({ where: { userId } }),
    prisma.copaParticipant.findMany({
      where: { userId },
      include: { copa: { select: { name: true, year: true } } },
    }),
    prisma.copaArtist.findMany({ where: { ownerId: userId } }),
    prisma.copaVote.findMany({ where: { userId } }),
    prisma.supportTicket.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, isStaff: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    exportMeta: {
      exportedAt: new Date().toISOString(),
      format: "JSON",
      version: 1,
      platform: "ChartFM",
      rightsNote:
        "Exportação gerada nos termos da LGPD (Lei 13.709/2018, art. 18) e do GDPR (Regulamento UE 2016/679, arts. 15 e 20).",
      excludedForSecurity: [
        "Senha (armazenada apenas como hash irreversível)",
        "Tokens OAuth do Spotify e YouTube",
        "Tokens de redefinição de senha e verificação de e-mail",
      ],
    },
    account: {
      ...accountFields,
      hasPassword: Boolean(passwordHash),
      spotifyConnected: Boolean(spotifyRefreshToken),
      youtubeConnected: Boolean(youtubeRefreshToken),
    },
    paradas,
    charts: charts.map(({ entries, ...chart }) => ({
      ...chart,
      entries: entries.map(({ song, ...entry }) => ({
        ...entry,
        song: {
          title: song.title,
          artist: song.artist,
          album: song.album,
          spotifyId: song.spotifyId,
        },
      })),
    })),
    interactions: {
      chartLikes,
      chartReposts,
      comments,
      commentLikes,
      commentReplies,
      postLikes,
      postReplies,
    },
    posts,
    communities: {
      memberships: communityMemberships,
      owned: ownedCommunities,
    },
    social: {
      following: followerLinks.map(({ following, createdAt }) => ({
        handle: following.handle,
        name: following.name,
        since: createdAt,
      })),
      followers: followingLinks.map(({ follower, createdAt }) => ({
        handle: follower.handle,
        name: follower.name,
        since: createdAt,
      })),
    },
    notifications: {
      received: notificationsReceived,
      sentAsActor: notificationsSent,
    },
    albumReviews,
    albumReviewHelpfulVotes: albumReviewHelpful,
    videoClips: {
      uploaded: uploadedVideoClips,
      votes: videoClipVotes,
      choices: videoClipChoices,
    },
    albumClub: {
      nominations: albumClubNominations,
      pollVotes: albumClubPollVotes,
    },
    push: {
      submissions: pushSubmissions,
      votes: pushVotes,
    },
    recommendations: {
      created: songRecommendations,
      likes: songRecommendationLikes,
      comments: songRecommendationComments,
      commentLikes: songRecommendationCommentLikes,
      commentReplies: songRecommendationCommentReplies,
    },
    copa: {
      participations: copaParticipations,
      artists: copaArtists,
      votes: copaVotes,
    },
    support: {
      tickets: supportTickets,
    },
  };
}
