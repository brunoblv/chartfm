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

export interface PushAdminMemberSubmission {
  id: string;
  order: number;
  userId: string;
  handle: string;
  name: string;
  avatarColor: string;
  hasVoted: boolean;
  createdAt: string;
  spotifyTrackId: string;
  song: {
    title: string;
    artist: string;
    spotifyUrl: string | null;
    coverUrl: string | null;
  };
}

export interface PushAdminMembersRound {
  id: string;
  number: number;
  season: number;
  phase: PushPhase;
  title: string;
  submissionCount: number;
}

export interface PushAdminMembersPayload {
  round: PushAdminMembersRound | null;
  submissions: PushAdminMemberSubmission[];
}
