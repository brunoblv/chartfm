import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import type { WeeklySpotlightWinner } from "@/lib/weekly-spotlight-poll";

type Props = {
  winner: WeeklySpotlightWinner;
};

/** Card da vencedora da Votação da Semana exibido na Parada Global (como na parada de usuário). */
export function GlobalSpotlightWinnerCard({ winner }: Props) {
  const isFlashback = winner.category === "flashback";
  const label = isFlashback ? "Flashback da Semana" : "Melhor da Semana";
  const color = isFlashback ? "#7C3AED" : "var(--accent)";
  const { song, nominators, totalPoints } = winner;
  const spotifyUrl =
    song.spotifyUrl ?? (song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        padding: 16,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div style={{ width: 110, flexShrink: 0 }}>
        <Cover
          cover={song.cover}
          song={{ title: song.title, artist: song.artist, imageUrl: song.cover.imageUrl ?? undefined }}
          size={110}
          rounded={12}
          style={{ width: "100%", height: "auto", aspectRatio: "1" }}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
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

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Indicada por</span>
          {nominators.map((n) => (
            <Link
              key={n.id}
              href={`/profile/${encodeURIComponent(n.handle)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Avatar user={{ name: n.name, avatar: n.avatarColor }} imageUrl={n.image} size={20} />
              @{n.handle}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {totalPoints} {totalPoints === 1 ? "ponto" : "pontos"} da comunidade
          </span>
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "#1DB954",
                textDecoration: "none",
              }}
            >
              <ExternalLink size={13} />
              Abrir no Spotify
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
