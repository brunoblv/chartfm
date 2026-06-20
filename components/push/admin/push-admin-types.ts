export type PushPhase = "SUBMISSION" | "LISTENING" | "RANKING" | "RESULT";

export interface RoundRow {
  id: string;
  number: number;
  title: string | null;
  phase: PushPhase;
  season: number;
  submissionEndsAt: string;
  listeningEndsAt: string;
  rankingEndsAt: string;
  spotifyPlaylistId: string | null;
  youtubePlaylistId: string | null;
  createdAt: string;
  submissionCount: number;
}

export interface IntegrationStatus {
  spotifyConnected: boolean;
  youtubeConnected: boolean;
  youtubeChannelHandle: string | null;
}
