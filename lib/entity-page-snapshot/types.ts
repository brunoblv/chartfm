export type CoverSnapshot = {
  palette: [string, string];
  seed: number;
  imageUrl?: string | null;
};

export type FanSnapshot = {
  user: { id: string; handle: string; name: string; avatar: string; image: string | null };
  points: number;
};

export type ArtistSongSnapshot = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  albumRefId: number | null;
  points: number;
  cover: CoverSnapshot;
  weeks: number;
  peak: number;
  number1s: number;
  currentWeekPos: number;
  isFeat?: boolean;
};

export type ArtistAlbumSnapshot = {
  albumId: number | null;
  name: string;
  songs: number;
  points: number;
  cover: CoverSnapshot;
};

export type ArtistPageSnapshotPayload = {
  builtAt: string;
  canonicalName: string;
  palette: [string, string];
  heroImageUrl: string | null;
  heroSpotifyUrl: string | null;
  artistRefId: number | null;
  listenersCount: number;
  number1s: number;
  totalPoints: number;
  songs: ArtistSongSnapshot[];
  allAlbums: ArtistAlbumSnapshot[];
  bigFans: FanSnapshot[];
};

export type AlbumSongSnapshot = {
  key: string;
  songId: string;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  dbArtist: string;
  title: string;
  points: number;
  cover: CoverSnapshot;
  weeks: number;
  peak: number;
  number1s: number;
};

export type AlbumPageSnapshotPayload = {
  builtAt: string;
  canonicalAlbum: string;
  canonicalArtist: string;
  coverImageUrl: string | null;
  releaseDate: string | null;
  palette: [string, string];
  coverForHero: CoverSnapshot;
  stats: { label: string; value: number; color: string }[];
  songs: AlbumSongSnapshot[];
  topFans: FanSnapshot[];
  artistSpotifyId: string | null;
  artistDbId: number | null;
  albumDbId: number | null;
};

export type SongTopUserSnapshot = {
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
  points: number;
};

export type SongPageSnapshotPayload = {
  builtAt: string;
  songId: string;
  title: string;
  artist: string;
  album: string;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  artistDbId: number | null;
  albumDbId: number | null;
  coverImageUrl: string | null;
  paletteA: string;
  paletteB: string;
  coverSeed: number;
  hasChartPresence: boolean;
  chartEntries: number;
  globalStats: {
    totalPoints: number;
    uniqueUsers: number;
    weeksTop100: number;
    number1s: number;
    peak: number;
  };
  topUsers: SongTopUserSnapshot[];
};
