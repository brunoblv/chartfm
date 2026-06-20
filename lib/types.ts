export interface Cover {
  palette: [string, string];
  seed: number;
  /** URL da capa (ex.: CDN do Spotify) quando disponível */
  imageUrl?: string | null;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  imageUrl?: string | null;
  bio: string;
  followers: number;
  following: number;
  streak: number;
  verified?: boolean;
  isStaff?: boolean;
  paradaNome?: string | null;
  paradaLogo?: string | null;
}

export interface Song {
  /** ID na tabela `Song` (Prisma cuid). Usado em `/song/<id>` quando não há `spotifyId` — links estáveis para importações. */
  id?: string | null;
  title: string;
  artist: string;
  /**
   * Texto em `Song.artist` na BD (import/planilha). Usado no slug de `/song/...` quando `artist` é
   * substituído por `artistRef.name` para exibição — evita URL que não bate com a resolução na página.
   */
  slugArtist?: string | null;
  /** Artistas secundários (feats), sem incluir o principal. */
  featArtists?: string[];
  album: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  /** ID em `artists` (links `/artist/{id}`) quando a faixa está ligada a `Artist`. */
  artistRefId?: number | null;
  /** ID em `albums` (links `/album/{artistId}_{albumId}`) quando a faixa está ligada a `Album`. */
  albumRefId?: number | null;
  /** URL da capa (normalmente `Album.coverUrl` carregada na query) */
  imageUrl?: string | null;
  /** Página da faixa no Last.fm (busca fallback) */
  lastfmUrl?: string | null;
}

export interface ChartEntry {
  position: number;
  song: Song;
  cover: Cover;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  videoClipImageUrl?: string | null;
}

export interface PersonalDropoutEntry {
  lastPos: number;
  song: Song;
  cover: Cover;
  peak: number;
  weeks: number;
  points: number;
}

export interface Chart {
  id: string;
  week: number;
  weekLabel: string;
  dateRange: string;
  entries: ChartEntry[];
  likes: number;
  comments: number;
  reposts: number;
}

export interface UserWithCharts extends User {
  charts: Chart[];
}

export interface TimelineItem {
  user: UserWithCharts;
  chart: Chart;
  postedAgo: string;
}

export interface GlobalChartEntry {
  position: number;
  song: Song;
  cover: Cover;
  points: number;
  voters: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos?: number | null;
  growthPct?: number | null;
  peak: number;
  weeks: number;
  /** Semanas em #1 no Global 100 (era 2026+). */
  numberOnes?: number;
}

export interface ArtistSong {
  title: string;
  album: string;
  cover: Cover;
  points: number;
  appearances: number;
  bestPos: number;
}

export interface Artist {
  name: string;
  totalPoints: number;
  listeners: number;
  number1s: number;
  songs: ArtistSong[];
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  cover: [string, string];
  members: number;
  posts: number;
  founded: string;
  privacy?: "public" | "private";
  admins: UserWithCharts[];
  chart: GlobalChartEntry[];
  memberSample?: UserWithCharts[];
}

export interface Post {
  id: string;
  community: Community;
  user: UserWithCharts;
  kind: "text" | "image" | "youtube";
  text: string;
  imagePalette?: [string, string];
  imageText?: string;
  ytTitle?: string;
  ytChannel?: string;
  ytThumb?: [string, string];
  likes: number;
  replies: number;
  shares: number;
  postedAgo: string;
}

export interface PostReply {
  user: UserWithCharts;
  text: string;
  likes: number;
  time: string;
}

export interface Comment {
  user: UserWithCharts;
  text: string;
  likes: number;
  time: string;
  reactions: string[];
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "repost" | "reaction" | "milestone";
  user: UserWithCharts | null;
  text: string;
  target: string | null;
  time: string;
  unread: boolean;
}
