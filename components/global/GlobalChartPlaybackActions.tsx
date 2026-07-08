"use client";

import { Music2, Youtube } from "lucide-react";
import { GlobalSpotifyPlaylistButton } from "@/components/global/GlobalSpotifyPlaylistButton";
import { useTranslations } from "@/hooks/useTranslations";
import type { GlobalPlaylistKind, GlobalPlaylistPeriod } from "@/lib/global-playlist-tracks";

export type GlobalChartSpotifyConfig = {
  kind: GlobalPlaylistKind;
  weekIndex: number;
  genreSlug?: string;
  period?: GlobalPlaylistPeriod;
  returnPath: string;
};

type Props = {
  youtubePlaylistId?: string | null;
  /** Playlist oficial pública (atualizada automaticamente no cron semanal). */
  spotifyPlaylistId?: string | null;
  spotify?: GlobalChartSpotifyConfig | null;
  youtubeLabel?: string;
  spotifyLabel?: string;
};

export function GlobalChartPlaybackActions({
  youtubePlaylistId,
  spotifyPlaylistId,
  spotify,
  youtubeLabel,
  spotifyLabel,
}: Props) {
  const { t } = useTranslations();
  const youtubeText = youtubeLabel ?? t("global.youtubeListen");
  const spotifyText = spotifyLabel ?? t("global.spotifyListen");

  if (!youtubePlaylistId && !spotifyPlaylistId && !spotify) return null;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 24 }}>
      {spotifyPlaylistId ? (
        <a
          href={`https://open.spotify.com/playlist/${spotifyPlaylistId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#1DB954",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(30,215,96,0.35)",
          }}
        >
          <Music2 size={16} />
          {spotifyText}
        </a>
      ) : null}
      {youtubePlaylistId ? (
        <a
          href={`https://www.youtube.com/playlist?list=${youtubePlaylistId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#FF0000",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(255,0,0,0.30)",
          }}
        >
          <Youtube size={16} fill="white" />
          {youtubeText}
        </a>
      ) : null}
      {spotify ? <GlobalSpotifyPlaylistButton {...spotify} /> : null}
    </div>
  );
}
