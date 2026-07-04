import type { Prisma } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Usuários com qualquer ação na plataforma desde `since` (mesma base do WAU em analytics). */
export function userActiveSinceFilter(since: Date): Prisma.UserWhereInput {
  return {
    OR: [
      { charts: { some: { postedAt: { gte: since } } } },
      { likes: { some: { createdAt: { gte: since } } } },
      { comments: { some: { createdAt: { gte: since } } } },
      { paradaComments: { some: { createdAt: { gte: since } } } },
      { posts: { some: { createdAt: { gte: since } } } },
      { pushVotes: { some: { submittedAt: { gte: since } } } },
      { pushSubmissions: { some: { createdAt: { gte: since } } } },
      { copaVotes: { some: { createdAt: { gte: since } } } },
      { albumReviews: { some: { createdAt: { gte: since } } } },
      { songRecommendations: { some: { createdAt: { gte: since } } } },
      { albumClubPollVotes: { some: { createdAt: { gte: since } } } },
    ],
  };
}

export function userActiveInLastDaysFilter(days: number): Prisma.UserWhereInput {
  return userActiveSinceFilter(new Date(Date.now() - days * DAY_MS));
}
