import { ExternalLink } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import type { ChartSpotlightSong } from "@/lib/chart-spotlight";

type Props = {
  kind: "flashback" | "destaque";
  song: ChartSpotlightSong;
};

export function ChartSpotlightCard({ kind, song }: Props) {
  const label = kind === "flashback" ? "Flashback" : "Destaque";
  const spotifyUrl =
    song.spotifyUrl ??
    (song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: kind === "flashback" ? "#7C3AED" : "var(--accent)",
        }}
      >
        {label}
      </div>
      <div style={{ width: "100%", maxWidth: 248 }}>
        <Cover
          cover={song.cover}
          song={{ title: song.title, artist: song.artist, imageUrl: song.cover.imageUrl ?? undefined }}
          size={220}
          rounded={12}
          style={{ width: "100%", height: "auto", aspectRatio: "1" }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {song.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {song.artist}
        </div>
      </div>
      {spotifyUrl && (
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#1DB954",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={14} />
          Abrir no Spotify
        </a>
      )}
    </div>
  );
}
