export interface SongData {
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
  albumReleaseDate?: string | null;
}

export interface ParticipantData {
  userId: string;
  handle: string | null;
  name: string | null;
  avatarColor: string;
  isMe: boolean;
}

export interface SubmissionData {
  id: string;
  userId: string;
  userHandle: string | null;
  userName: string | null;
  spotifyTrackId: string;
  song: SongData;
}

export interface ResultData {
  submissionId: string;
  userId: string;
  userHandle: string;
  userName: string;
  spotifyTrackId: string;
  song: SongData;
  totalPoints: number;
  rank: number;
}

export interface RoundData {
  id: string;
  number: number;
  title: string | null;
  phase: "SUBMISSION" | "LISTENING" | "RANKING" | "RESULT";
  submissionEndsAt: string;
  listeningEndsAt: string;
  rankingEndsAt: string;
  spotifyPlaylistId: string | null;
  youtubePlaylistId: string | null;
  season: number;
  submissionCount: number;
  mySubmission: { id: string; spotifyTrackId: string; song: SongData } | null;
  submissions: SubmissionData[] | null;
  myVotes: { submissionId: string; position: number }[] | null;
  results: ResultData[] | null;
  participants: ParticipantData[];
}

export interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  previewUrl: string | null;
  externalUrl: string;
}
