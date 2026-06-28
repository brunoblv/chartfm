import type { Chart, ChartEntry, PersonalDropoutEntry, User, UserWithCharts } from "@/lib/types";
import { isPrivilegedRole } from "@/lib/permissions";
import { resolveChartEntryCoverUrl } from "@/lib/chart-entry-cover";

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
  role?: string | null;
  image: string | null;
  paradaNome: string | null;
  paradaLogo?: string | null;
  genres: string[];
  lastfmUser?: string | null;
  twitterUser?: string | null;
  instagramUser?: string | null;
  charts: Array<{
    id: string;
    weekIndex: number;
    weekLabel: string;
    dateRange: string;
    likes: number;
    comments: number;
    reposts: number;
    entries: Array<{
      songId: string;
      position: number;
      status: string;
      delta: number | null;
      prevPos: number | null;
      peak: number;
      weeks: number;
      coverPaletteA: string;
      coverPaletteB: string;
      coverSeed: number;
      albumBySpotify?: { coverUrl?: string | null } | null;
      song: {
        id: string;
        title: string;
        exhibitionName?: string | null;
        artist: string;
        album: string | null;
        albumRef?: { id?: number; coverUrl?: string | null } | null;
        spotifyId?: string | null;
        artistSpotifyId?: string | null;
        artistRef?: { id?: number; name: string } | null;
        feats?: Array<{ artist: { name: string } }>;
      };
    }>;
  }>;
};

function entryStatus(s: string): ChartEntry["status"] {
  if (s === "up" || s === "down" || s === "same" || s === "new" || s === "return") return s;
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
    songId: string;
    position: number;
    status: string;
    delta: number | null;
    prevPos: number | null;
    peak: number;
    weeks: number;
    coverPaletteA: string;
    coverPaletteB: string;
    coverSeed: number;
    albumBySpotify?: { coverUrl?: string | null } | null;
    song: {
      id: string;
      title: string;
      exhibitionName?: string | null;
      artist: string;
      album: string | null;
      albumRef?: { id?: number; coverUrl?: string | null } | null;
      spotifyId?: string | null;
      artistSpotifyId?: string | null;
      artistRef?: { id?: number; name: string } | null;
      feats?: Array<{ artist: { name: string } }>;
    };
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
    entries: c.entries.map((e) => {
      const img = resolveChartEntryCoverUrl(e);
      return {
      position: e.position,
      song: {
        id: e.song.id,
        title: e.song.exhibitionName?.trim() || e.song.title,
        artist: e.song.artistRef?.name?.trim() || e.song.artist,
        slugArtist: e.song.artist,
        featArtists: (e.song.feats ?? []).map((f) => f.artist?.name).filter((name): name is string => Boolean(name)),
        album: e.song.album ?? "",
        spotifyId: e.song.spotifyId ?? null,
        artistSpotifyId: e.song.artistSpotifyId ?? null,
        artistRefId: e.song.artistRef?.id ?? null,
        albumRefId: e.song.albumRef?.id ?? null,
        imageUrl: img,
      },
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: img,
      },
      status: entryStatus(e.status),
      delta: e.delta,
      prevPos: e.prevPos,
      peak: e.peak,
      weeks: e.weeks,
      };
    }),
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
    isStaff: isPrivilegedRole(db.role),
    charts,
  };
}

export type PublicProfilePayload = {
  user: UserWithCharts;
  imageUrl: string | null;
  paradaNome: string | null;
  paradaLogo: string | null;
  genres: string[];
  isFollowing: boolean;
  lastfmUser: string | null;
  twitterUser: string | null;
  instagramUser: string | null;
};

export function buildPublicProfilePayload(
  db: PrismaProfileUser,
  isFollowing = false,
): PublicProfilePayload {
  return {
    user: mapPrismaUserToUserWithCharts(db),
    imageUrl: db.image,
    paradaNome: db.paradaNome,
    paradaLogo: db.paradaLogo ?? null,
    genres: db.genres ?? [],
    isFollowing,
    lastfmUser: db.lastfmUser ?? null,
    twitterUser: db.twitterUser ?? null,
    instagramUser: db.instagramUser ?? null,
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
  paradaLogo: string | null;
};

export type ChartDetailPayload = {
  user: User;
  chart: Chart;
  imageUrl: string | null;
  paradaLogo: string | null;
  previousChart?: { id: string; weekLabel: string } | null;
  nextChart?: { id: string; weekLabel: string } | null;
  personalNumberOnes?: Record<string, number>;
  globalNumberOnes?: Record<string, number>;
  dropouts?: PersonalDropoutEntry[];
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
    paradaLogo: chart.user.paradaLogo,
  };
}
