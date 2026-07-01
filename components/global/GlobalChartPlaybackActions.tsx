"use client";

import { Youtube } from "lucide-react";
import { GlobalSpotifyPlaylistButton } from "@/components/global/GlobalSpotifyPlaylistButton";
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
  spotify?: GlobalChartSpotifyConfig | null;
  youtubeLabel?: string;
};

export function GlobalChartPlaybackActions({
  youtubePlaylistId,
  spotify,
  youtubeLabel = "Ouvir no YouTube",
}: Props) {
  if (!youtubePlaylistId && !spotify) return null;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 24 }}>
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
          {youtubeLabel}
        </a>
      ) : null}
      {spotify ? <GlobalSpotifyPlaylistButton {...spotify} /> : null}
    </div>
  );
}
