/** Constantes e tipos compartilhados (seguros para client components). */

/** Duração padrão do trecho em Shorts / Reels / TikTok. */
export const VIDEOPARADA_SHORTS_SECONDS = 6;
/** Duração padrão do trecho no vídeo completo do YouTube. */
export const VIDEOPARADA_YOUTUBE_SECONDS = 11;

export const VIDEOPARADA_PLATFORMS = ["youtube", "vimeo", "dailymotion", "other"] as const;
export type VideoparadaPlatform = (typeof VIDEOPARADA_PLATFORMS)[number];

export type VideoparadaChartOption = {
  kind: string;
  label: string;
  shortLabel: string;
};

export type VideoparadaWeekOption = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
};

export type VideoparadaClipConfigInput = {
  songId: string;
  position: number;
  videoUrl: string | null;
  platform: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  useAutoChorus: boolean;
  forceDebut: boolean;
  skipAutoVideo: boolean;
  notes: string | null;
};

export type VideoparadaEntryRow = {
  position: number;
  songId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  /** Clipe oficial já cadastrado em SongVideoClip (sugestão). */
  suggestedYoutubeId: string | null;
  config: {
    id: string | null;
    videoUrl: string | null;
    platform: string | null;
    startSeconds: number | null;
    endSeconds: number | null;
    useAutoChorus: boolean;
    forceDebut: boolean;
    skipAutoVideo: boolean;
    notes: string | null;
  };
};
