"use client";

import { useState } from "react";
import Link from "next/link";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath, buildArtistPath } from "@/lib/music-routes";

type ArtistRow = {
  name: string;
  spotifyId?: string | null;
  listeners: number;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

type SongRow = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

export function HotTabs({
  artists,
  songs,
}: {
  artists: ArtistRow[];
  songs: SongRow[];
}) {
  const [tab, setTab] = useState<"artists" | "songs">("artists");
  const gridArtists = "60px 90px 76px minmax(0,1fr) 100px 100px";
  const gridSongs = "60px 90px minmax(0,1fr) minmax(0,1fr) 100px";

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Em alta</h2>
        <div style={{ display: "flex", gap: 4, background: "var(--fill-inset)", borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setTab("artists")}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              background: tab === "artists" ? "var(--surface)" : "transparent",
              color: tab === "artists" ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === "artists" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
            }}
          >
            Artistas
          </button>
          <button
            onClick={() => setTab("songs")}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              background: tab === "songs" ? "var(--surface)" : "transparent",
              color: tab === "songs" ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === "songs" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
            }}
          >
            Músicas
          </button>
        </div>
      </div>

      {tab === "artists" ? (
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: gridArtists, padding: "10px 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
            {["Pos", "Mudança", "", "Artista", "Entradas", "Usuários"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
            ))}
          </div>
          {artists.map((a, i) => (
            <Link key={a.name} href={buildArtistPath(a.name, a.spotifyId)} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "grid", gridTemplateColumns: gridArtists, alignItems: "center", padding: "8px 20px", borderBottom: "1px solid var(--divider-soft)" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 12, letterSpacing: "-0.02em" }}>{i + 1}</div>
                <div style={{ padding: "0 8px" }}>
                  <MovementBadge status={a.status} delta={a.delta} />
                </div>
                <div style={{ padding: "6px 8px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${COVER_PALETTES[i % COVER_PALETTES.length][0]}, ${COVER_PALETTES[i % COVER_PALETTES.length][1]})` }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, padding: "0 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{a.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px", fontVariantNumeric: "tabular-nums" }}>{a.listeners}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px", fontVariantNumeric: "tabular-nums" }}>{a.users}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: gridSongs, padding: "10px 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
            {["Pos", "Mudança", "Música", "Artista", "Usuários"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
            ))}
          </div>
          {songs.map((s, i) => (
            <div key={`${s.title}-${s.artist}`} style={{ display: "grid", gridTemplateColumns: gridSongs, alignItems: "center", padding: "8px 20px", borderBottom: "1px solid var(--divider-soft)" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 12, letterSpacing: "-0.02em" }}>{i + 1}</div>
              <div style={{ padding: "0 8px" }}>
                <MovementBadge status={s.status} delta={s.delta} />
              </div>
              <Link href={buildSongPath(s)} style={{ fontSize: 14, fontWeight: 600, padding: "0 12px", color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </Link>
              <Link href={buildArtistPath(s.artist, s.artistSpotifyId)} style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 8px", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.artist}
              </Link>
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px", fontVariantNumeric: "tabular-nums" }}>{s.users}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
