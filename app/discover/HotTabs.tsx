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
  status: "new" | "up" | "down" | "same";
  delta: number | null;
};

type SongRow = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  users: number;
  status: "new" | "up" | "down" | "same";
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

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Em alta</h2>
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setTab("artists")}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              background: tab === "artists" ? "white" : "transparent",
              color: tab === "artists" ? "#1D1D1F" : "#86868B",
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
              background: tab === "songs" ? "white" : "transparent",
              color: tab === "songs" ? "#1D1D1F" : "#86868B",
              boxShadow: tab === "songs" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
            }}
          >
            Músicas
          </button>
        </div>
      </div>

      {tab === "artists" ? (
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 60px 1fr 120px 120px 100px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            {["#", "", "Artista", "Entradas", "Usuários", "Tendência"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "4px 8px" }}>{h}</div>
            ))}
          </div>
          {artists.map((a, i) => (
            <Link key={a.name} href={buildArtistPath(a.name, a.spotifyId)} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 60px 1fr 120px 120px 100px", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, padding: "0 8px" }}>{i + 1}</div>
                <div style={{ padding: "4px 8px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${COVER_PALETTES[i % COVER_PALETTES.length][0]}, ${COVER_PALETTES[i % COVER_PALETTES.length][1]})` }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, padding: "0 8px" }}>{a.name}</div>
                <div style={{ fontSize: 14, color: "#86868B", padding: "0 8px" }}>{a.listeners}</div>
                <div style={{ fontSize: 14, color: "#86868B", padding: "0 8px" }}>{a.users}</div>
                <div style={{ padding: "0 8px" }}>
                  <MovementBadge status={a.status} delta={a.delta} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 120px 100px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            {["#", "Música", "Artista", "Usuários", "Tendência"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "4px 8px" }}>{h}</div>
            ))}
          </div>
          {songs.map((s, i) => (
            <div key={`${s.title}-${s.artist}`} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 120px 100px", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, padding: "0 8px" }}>{i + 1}</div>
              <Link href={buildSongPath(s)} style={{ fontSize: 14, fontWeight: 600, padding: "0 8px", color: "#1D1D1F", textDecoration: "none" }}>
                {s.title}
              </Link>
              <Link href={buildArtistPath(s.artist, s.artistSpotifyId)} style={{ fontSize: 14, color: "#86868B", padding: "0 8px", textDecoration: "none" }}>
                {s.artist}
              </Link>
              <div style={{ fontSize: 14, color: "#86868B", padding: "0 8px" }}>{s.users}</div>
              <div style={{ padding: "0 8px" }}>
                <MovementBadge status={s.status} delta={s.delta} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
