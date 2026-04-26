"use client";

import { useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COVER_PALETTES } from "@/lib/data";
import { formatSongArtist } from "@/lib/song-artist";
import type { Cover as CoverData } from "@/lib/types";
import Link from "next/link";

type SongEntry = {
  position: number;
  song: { title: string; artist: string };
  cover: CoverData;
  status: "new" | "up" | "down" | "same";
  delta?: number | null;
  prevPos?: number | null;
  peak: number;
  weeks: number;
  points: number;
  growthPct?: number | null;
};

type ArtistEntry = {
  position: number;
  name: string;
  totalPoints: number;
  chartCount: number;
  status: "new" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  growthPct: number | null;
  imageUrl?: string | null;
};

export function GlobalTabs({
  weeklySongs,
  weeklyArtists,
  overallSongs,
  overallArtists,
}: {
  weeklySongs: SongEntry[];
  weeklyArtists: ArtistEntry[];
  overallSongs: SongEntry[];
  overallArtists: ArtistEntry[];
}) {
  const [tab, setTab] = useState<"songs" | "artists">("songs");
  const [viewSize, setViewSize] = useState<"small" | "large">("small");
  const [period, setPeriod] = useState<"weekly" | "overall">("weekly");
  const songs = period === "weekly" ? weeklySongs : overallSongs;
  const artists = period === "weekly" ? weeklyArtists : overallArtists;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{
          display: "flex",
          gap: 4,
          background: "rgba(0,0,0,0.04)",
          borderRadius: 12,
          padding: 4,
          width: "fit-content",
        }}>
          {(["songs", "artists"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px",
                borderRadius: 9,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "-0.01em",
                transition: "all 0.15s",
                background: tab === t ? "white" : "transparent",
                color: tab === t ? "#1D1D1F" : "#86868B",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {t === "songs" ? "Top 100 Músicas" : "Top 100 Artistas"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4 }}>
          <button
            onClick={() => setPeriod("weekly")}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              background: period === "weekly" ? "white" : "transparent",
              color: period === "weekly" ? "#1D1D1F" : "#86868B",
              boxShadow: period === "weekly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Semanal
          </button>
          <button
            onClick={() => setPeriod("overall")}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              background: period === "overall" ? "white" : "transparent",
              color: period === "overall" ? "#1D1D1F" : "#86868B",
              boxShadow: period === "overall" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Overall
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4 }}>
          <button
            onClick={() => setViewSize("small")}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              background: viewSize === "small" ? "white" : "transparent",
              color: viewSize === "small" ? "#1D1D1F" : "#86868B",
              boxShadow: viewSize === "small" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Menor
          </button>
          <button
            onClick={() => setViewSize("large")}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              background: viewSize === "large" ? "white" : "transparent",
              color: viewSize === "large" ? "#1D1D1F" : "#86868B",
              boxShadow: viewSize === "large" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Maior
          </button>
        </div>
      </div>

      {tab === "songs" ? (
        <SongsTable songs={songs} viewSize={viewSize} />
      ) : (
        <ArtistsTable artists={artists} viewSize={viewSize} />
      )}
    </div>
  );
}

function SongsTable({ songs, viewSize }: { songs: SongEntry[]; viewSize: "small" | "large" }) {
  const isLarge = viewSize === "large";
  const gridTemplateColumns = isLarge
    ? "80px 112px 120px minmax(0,1fr) 96px 96px 80px 120px"
    : "60px 76px 90px minmax(0,1fr) 80px 80px 70px 100px";
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const coverSize = isLarge ? 92 : 60;
  const posSize = isLarge ? 28 : 20;
  const titleSize = isLarge ? 17 : 14;
  const artistSize = isLarge ? 14 : 12;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;
  const growthSize = isLarge ? 15 : 13;
  const gridTemplateColumnsWithGrowth = `${gridTemplateColumns} 90px`;
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridTemplateColumnsWithGrowth, padding: isLarge ? "12px 24px" : "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["Pos", "", "Mudança", "Música", "Semana ant.", "Sem.", "Pico", "Pontos", "Cresc."].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "#86868B", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {songs.map((e) => (
        <div
          key={e.position}
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplateColumnsWithGrowth,
            alignItems: "center",
            padding: rowPadding,
            borderBottom: "1px solid rgba(0,0,0,0.04)",
            gap: 0,
          }}
        >
          <div style={{
            fontSize: posSize,
            fontWeight: 700,
            color: "#000000",
            fontVariantNumeric: "tabular-nums",
            textAlign: "right" as const, paddingRight: 12,
            letterSpacing: "-0.02em",
          }}>
            {e.position}
          </div>
          <div style={{ padding: "6px 8px" }}>
            <Cover cover={e.cover} song={e.song} size={coverSize} rounded={isLarge ? 14 : 10} />
          </div>
          <div style={{ padding: "0 8px" }}>
            <MovementBadge status={e.status} delta={e.delta} />
          </div>
          <div style={{ padding: "0 12px", minWidth: 0 }}>
            <div style={{ fontSize: titleSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{e.song.title}</div>
              <div style={{ fontSize: artistSize, color: "#86868B" }}>{formatSongArtist(e.song)}</div>
          </div>
          <div style={{ fontSize: valueSize, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.prevPos ?? "—"}
          </div>
          <div style={{ fontSize: valueSize, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.weeks}
          </div>
          <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.peak}
          </div>
          <div style={{ fontSize: pointsSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#FA243C", padding: "0 8px" }}>
            {e.points}
          </div>
          <div style={{ fontSize: growthSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: (e.growthPct ?? null) !== null && (e.growthPct ?? 0) >= 0 ? "#16A34A" : "#DC2626" }}>
            {(e.growthPct ?? null) === null ? "—" : `${(e.growthPct ?? 0) >= 0 ? "+" : ""}${(e.growthPct ?? 0).toFixed(1)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistsTable({ artists, viewSize }: { artists: ArtistEntry[]; viewSize: "small" | "large" }) {
  const isLarge = viewSize === "large";
  const gridTemplateColumns = isLarge
    ? "80px 104px 120px minmax(0,1fr) 96px 96px 80px 130px"
    : "60px 76px 90px minmax(0,1fr) 80px 80px 70px 100px";
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const posSize = isLarge ? 28 : 20;
  const avatarSize = isLarge ? 88 : 60;
  const nameSize = isLarge ? 17 : 14;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;
  const growthSize = isLarge ? 15 : 13;
  const gridTemplateColumnsWithGrowth = `${gridTemplateColumns} 90px`;
  if (artists.length === 0) {
    return (
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 40, textAlign: "center" as const, color: "#86868B", fontSize: 14 }}>
        Nenhuma parada publicada esta semana ainda.
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridTemplateColumnsWithGrowth, padding: isLarge ? "12px 24px" : "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["Pos", "", "Mudança", "Artista", "Semana ant.", "Sem.", "Pico", "Pontos", "Cresc."].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "#86868B", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {artists.map((a) => {
        const palette = COVER_PALETTES[(a.position - 1) % COVER_PALETTES.length];
        return (
          <Link
            key={a.name}
            href={`/artist/${encodeURIComponent(a.name)}`}
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplateColumnsWithGrowth,
              alignItems: "center",
              padding: rowPadding,
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{
              fontSize: posSize,
              fontWeight: 700,
              color: "#000000",
              fontVariantNumeric: "tabular-nums",
              textAlign: "right" as const, paddingRight: 12,
              letterSpacing: "-0.02em",
            }}>
              {a.position}
            </div>
            <div style={{ padding: "6px 8px" }}>
              {a.imageUrl ? (
                <img
                  src={a.imageUrl}
                  alt={a.name}
                  width={avatarSize}
                  height={avatarSize}
                  style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }}
                />
              ) : (
                <div style={{
                  width: avatarSize, height: avatarSize, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
                }} />
              )}
            </div>
            <div style={{ padding: "0 8px" }}>
              <MovementBadge status={a.status} delta={a.delta} />
            </div>
            <div style={{ padding: "0 12px", minWidth: 0 }}>
              <div style={{ fontSize: nameSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a.name}</div>
            </div>
            <div style={{ fontSize: valueSize, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {a.prevPos ?? "—"}
            </div>
            <div style={{ fontSize: valueSize, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {a.weeks}
            </div>
            <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {a.peak}
            </div>
            <div style={{ fontSize: pointsSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#FA243C", padding: "0 8px" }}>
              {a.totalPoints}
            </div>
            <div style={{ fontSize: growthSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: a.growthPct !== null && a.growthPct >= 0 ? "#16A34A" : "#DC2626" }}>
              {a.growthPct === null ? "—" : `${a.growthPct >= 0 ? "+" : ""}${a.growthPct.toFixed(1)}%`}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
