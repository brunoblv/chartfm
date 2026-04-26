import type { Chart, ChartEntry, User, UserWithCharts } from "@/lib/types";

type PrismaProfileUser = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  bio: string | null;
  followers: number;
  following: number;
  streak: number;
  verified: boolean;
  image: string | null;
  paradaNome: string | null;
  genres: string[];
  charts: Array<{
    id: string;
    weekIndex: number;
    weekLabel: string;
    dateRange: string;
    likes: number;
    comments: number;
    reposts: number;
    entries: Array<{
      position: number;
      status: string;
      delta: number | null;
      prevPos: number | null;
      peak: number;
      weeks: number;
      coverPaletteA: string;
      coverPaletteB: string;
      coverSeed: number;
      song: { title: string; artist: string; album: string | null };
    }>;
  }>;
};

function entryStatus(s: string): ChartEntry["status"] {
  if (s === "up" || s === "down" || s === "same" || s === "new") return s;
  return "same";
}

type PrismaChartRow = {
  id: string;
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  likes: number;
  comments: number;
  reposts: number;
  entries: Array<{
    position: number;
    status: string;
    delta: number | null;
    prevPos: number | null;
    peak: number;
    weeks: number;
    coverPaletteA: string;
    coverPaletteB: string;
    coverSeed: number;
    song: { title: string; artist: string; album: string | null };
  }>;
};

export function mapPrismaChartRowToChart(c: PrismaChartRow): Chart {
  return {
    id: c.id,
    week: c.weekIndex,
    weekLabel: c.weekLabel,
    dateRange: c.dateRange,
    likes: c.likes,
    comments: c.comments,
    reposts: c.reposts,
    entries: c.entries.map((e) => ({
      position: e.position,
      song: {
        title: e.song.title,
        artist: e.song.artist,
        album: e.song.album ?? "",
      },
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
      },
      status: entryStatus(e.status),
      delta: e.delta,
      prevPos: e.prevPos,
      peak: e.peak,
      weeks: e.weeks,
    })),
  };
}

export function mapPrismaUserToUserWithCharts(db: PrismaProfileUser): UserWithCharts {
  const charts: Chart[] = db.charts.map((c) => mapPrismaChartRowToChart(c));

  return {
    id: db.id,
    handle: db.handle,
    name: db.name,
    avatar: db.avatarColor,
    bio: db.bio ?? "",
    followers: db.followers,
    following: db.following,
    streak: db.streak,
    verified: db.verified,
    charts,
  };
}

export type PublicProfilePayload = {
  user: UserWithCharts;
  imageUrl: string | null;
  paradaNome: string | null;
  genres: string[];
  isFollowing: boolean;
};

export function buildPublicProfilePayload(
  db: PrismaProfileUser,
  isFollowing = false,
): PublicProfilePayload {
  return {
    user: mapPrismaUserToUserWithCharts(db),
    imageUrl: db.image,
    paradaNome: db.paradaNome,
    genres: db.genres ?? [],
    isFollowing,
  };
}

type PrismaChartOwner = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  bio: string | null;
  followers: number;
  following: number;
  streak: number;
  verified: boolean;
  image: string | null;
};

export type ChartDetailPayload = {
  user: User;
  chart: Chart;
  imageUrl: string | null;
  personalNumberOnes?: Record<string, number>;
  globalNumberOnes?: Record<string, number>;
};

/** Uma parada com autor (para página de detalhe). */
export function mapPrismaChartDetail(chart: PrismaChartRow & { user: PrismaChartOwner }): ChartDetailPayload {
  return {
    user: {
      id: chart.user.id,
      handle: chart.user.handle,
      name: chart.user.name,
      avatar: chart.user.avatarColor,
      bio: chart.user.bio ?? "",
      followers: chart.user.followers,
      following: chart.user.following,
      streak: chart.user.streak,
      verified: chart.user.verified,
    },
    chart: mapPrismaChartRowToChart(chart),
    imageUrl: chart.user.image,
  };
}
