"use client";

import { useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COVER_PALETTES } from "@/lib/data";
import { formatSongArtist } from "@/lib/song-artist";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Cover as CoverData } from "@/lib/types";
import Link from "next/link";

type SongEntry = {
  position: number;
  song: {
    id?: string | null;
    title: string;
    artist: string;
    slugArtist?: string | null;
    album?: string | null;
    spotifyId?: string | null;
    artistSpotifyId?: string | null;
    artistRefId?: number | null;
    featArtists?: string[];
  };
  cover: CoverData;
  status: "new" | "return" | "up" | "down" | "same";
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
  spotifyId?: string | null;
  totalPoints: number;
  chartCount: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  growthPct: number | null;
  imageUrl?: string | null;
};

const LIST_COVER_SIZE = 75;
const LARGE_COVER_SIZE = 125;

function StatPill({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent ?? "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

const segmentContainer: React.CSSProperties = {
  display: "flex",
  gap: 4,
  background: "var(--fill-subtle)",
  borderRadius: 12,
  padding: 4,
  width: "fit-content",
};

function segmentBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    borderRadius: 9,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    transition: "all 0.15s",
    background: active ? "var(--surface-elevated)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.14)" : "none",
  };
}

function segmentBtnSm(active: boolean): React.CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 9,
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    background: active ? "var(--surface-elevated)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.14)" : "none",
  };
}

export function GlobalTabs({
  weeklySongs,
  weeklyArtists,
  overallSongs,
  overallArtists,
  weeklyDropouts = [],
}: {
  weeklySongs: SongEntry[];
  weeklyArtists: ArtistEntry[];
  overallSongs: SongEntry[];
  overallArtists: ArtistEntry[];
  weeklyDropouts?: SongEntry[];
}) {
  const [tab, setTab] = useState<"songs" | "artists" | "saidas">("songs");
  const [viewSize, setViewSize] = useState<"small" | "large">("small");
  const [period, setPeriod] = useState<"weekly" | "overall">("weekly");
  const isMobile = useIsMobile();
  const songs = period === "weekly" ? weeklySongs : overallSongs;
  const artists = period === "weekly" ? weeklyArtists : overallArtists;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 10, marginBottom: 20 }}>
        {/* Main tab: Músicas / Artistas / Saídas */}
        <div style={{ ...segmentContainer, width: isMobile ? "100%" : "fit-content" }}>
          {(["songs", "artists", "saidas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...segmentBtn(tab === t), flex: isMobile ? 1 : undefined, padding: isMobile ? "10px 0" : "8px 20px" }}
            >
              {isMobile
                ? (t === "songs" ? "Músicas" : t === "artists" ? "Artistas" : "Saídas")
                : (t === "songs" ? "Top 100 Músicas" : t === "artists" ? "Top 100 Artistas" : `Saídas${weeklyDropouts.length > 0 ? ` (${weeklyDropouts.length})` : ""}`)}
            </button>
          ))}
        </div>

        {tab !== "saidas" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Period: Semanal / Overall */}
            <div style={{ ...segmentContainer, flex: isMobile ? 1 : undefined }}>
              <button onClick={() => setPeriod("weekly")} style={{ ...segmentBtnSm(period === "weekly"), flex: isMobile ? 1 : undefined }}>Semanal</button>
              <button onClick={() => setPeriod("overall")} style={{ ...segmentBtnSm(period === "overall"), flex: isMobile ? 1 : undefined }}>Overall</button>
            </div>

            {/* Size toggle: hidden on mobile */}
            {!isMobile && (
              <div style={segmentContainer}>
                <button onClick={() => setViewSize("small")} style={segmentBtnSm(viewSize === "small")}>Menor</button>
                <button onClick={() => setViewSize("large")} style={segmentBtnSm(viewSize === "large")}>Maior</button>
              </div>
            )}
          </div>
        )}
      </div>

      {tab === "saidas" ? (
        <DropoutsGlobalTable songs={weeklyDropouts} viewSize={viewSize} isMobile={isMobile} />
      ) : tab === "songs" ? (
        <SongsTable songs={songs} viewSize={viewSize} isMobile={isMobile} />
      ) : (
        <ArtistsTable artists={artists} viewSize={viewSize} isMobile={isMobile} />
      )}
    </div>
  );
}

function SongsTable({ songs, viewSize, isMobile }: { songs: SongEntry[]; viewSize: "small" | "large"; isMobile: boolean }) {
  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {songs.map((e) => (
          <div
            key={e.position}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 16px",
              borderBottom: "1px solid var(--divider-soft)",
              gap: 12,
            }}
          >
            {/* Position + badge */}
            <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: e.position <= 3 ? 22 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {e.position}
              </div>
              <div style={{ marginTop: 2 }}>
                <MovementBadge status={e.status} delta={e.delta} compact />
              </div>
            </div>

            {/* Cover */}
            <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
              <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={LIST_COVER_SIZE} rounded={8} />
            </Link>

            {/* Title + Artist */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "var(--text)" }}>
                {e.song.title}
              </Link>
              <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                {formatSongArtist(e.song)}
              </Link>
            </div>

            {/* ANT · PICO · SEM */}
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <StatPill label="ANT" value={e.prevPos ?? "—"} />
              <StatPill label="PICO" value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill label="SEM" value={e.weeks} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const coverCol = isLarge ? LARGE_COVER_SIZE + 20 : LIST_COVER_SIZE + 16;
  const gridTemplateColumns = isLarge
    ? `80px ${coverCol}px 120px minmax(0,1fr) 96px 96px 80px 120px`
    : `60px ${coverCol}px 90px minmax(0,1fr) 80px 80px 70px 100px`;
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const coverSize = isLarge ? LARGE_COVER_SIZE : LIST_COVER_SIZE;
  const posSize = isLarge ? 28 : 20;
  const titleSize = isLarge ? 17 : 14;
  const artistSize = isLarge ? 14 : 12;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;
  const growthSize = isLarge ? 15 : 13;
  const gridTemplateColumnsWithGrowth = `${gridTemplateColumns} 90px`;

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: gridTemplateColumnsWithGrowth,
        padding: isLarge ? "12px 24px" : "10px 20px",
        background: "var(--fill-inset)",
        borderBottom: "1px solid var(--divider)",
      }}>
        {["Pos", "", "Mudança", "Música", "Semana ant.", "Sem.", "Pico", "Pontos", "Cresc."].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
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
            borderBottom: "1px solid var(--divider-soft)",
            gap: 0,
          }}
        >
          <div style={{ fontSize: posSize, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right" as const, paddingRight: 12, letterSpacing: "-0.02em" }}>
            {e.position}
          </div>
          <Link href={buildSongPath(e.song)} style={{ padding: "6px 8px", lineHeight: 0 }}>
            <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={coverSize} rounded={isLarge ? 14 : 10} />
          </Link>
          <div style={{ padding: "0 8px" }}>
            <MovementBadge status={e.status} delta={e.delta} />
          </div>
          <div style={{ padding: "0 12px", minWidth: 0 }}>
            <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: titleSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit", textDecoration: "none" }}>
              {e.song.title}
            </Link>
            <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: artistSize, color: "var(--text-muted)", textDecoration: "none" }}>
              {formatSongArtist(e.song)}
            </Link>
          </div>
          <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.prevPos ?? "—"}
          </div>
          <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.weeks}
          </div>
          <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)" }}>
            {e.peak}
          </div>
          <div style={{ fontSize: pointsSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent)", padding: "0 8px" }}>
            {e.points}
          </div>
          <div style={{
            fontSize: growthSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px",
            color: (e.growthPct ?? null) !== null && (e.growthPct ?? 0) >= 0 ? "var(--up-fg)" : "var(--down-fg)",
          }}>
            {(e.growthPct ?? null) === null ? "—" : `${(e.growthPct ?? 0) >= 0 ? "+" : ""}${(e.growthPct ?? 0).toFixed(1)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExitBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", padding: "2px 7px", borderRadius: 6, background: "#1C1C1E", color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>
      SAIU
    </span>
  );
}

function DropoutsGlobalTable({ songs, viewSize, isMobile }: { songs: SongEntry[]; viewSize: "small" | "large"; isMobile: boolean }) {

  if (songs.length === 0) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 40, textAlign: "center" as const, color: "var(--text-muted)", fontSize: 14 }}>
        Nenhuma saída esta semana.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {songs.map((e) => (
          <div key={e.position} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--divider-soft)", gap: 12 }}>
            <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: e.position <= 3 ? 22 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {e.position}
              </div>
              <div style={{ marginTop: 2 }}><ExitBadge /></div>
            </div>
            <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
              <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={LIST_COVER_SIZE} rounded={8} />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "var(--text)" }}>
                {e.song.title}
              </Link>
              <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                {formatSongArtist(e.song)}
              </Link>
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <StatPill label="PICO" value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill label="SEM" value={e.weeks} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const coverCol = isLarge ? LARGE_COVER_SIZE + 20 : LIST_COVER_SIZE + 16;
  const gridCols = isLarge
    ? `80px ${coverCol}px 120px minmax(0,1fr) 96px 96px 80px 120px`
    : `60px ${coverCol}px 90px minmax(0,1fr) 80px 80px 70px 100px`;
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const coverSize = isLarge ? LARGE_COVER_SIZE : LIST_COVER_SIZE;
  const posSize = isLarge ? 28 : 20;
  const titleSize = isLarge ? 17 : 14;
  const artistSize = isLarge ? 14 : 12;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: isLarge ? "12px 24px" : "10px 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
        {["Últ.", "", "", "Música", "Semana ant.", "Sem.", "Pico", "Pontos"].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {songs.map((e) => (
        <div key={e.position} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: rowPadding, borderBottom: "1px solid var(--divider-soft)", gap: 0 }}>
          <div style={{ fontSize: posSize, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", textAlign: "right" as const, paddingRight: 12, letterSpacing: "-0.02em" }}>
            {e.position}
          </div>
          <Link href={buildSongPath(e.song)} style={{ padding: "6px 8px", lineHeight: 0 }}>
            <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={coverSize} rounded={isLarge ? 14 : 10} />
          </Link>
          <div style={{ padding: "0 8px" }}><ExitBadge /></div>
          <div style={{ padding: "0 12px", minWidth: 0 }}>
            <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: titleSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit", textDecoration: "none" }}>
              {e.song.title}
            </Link>
            <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: artistSize, color: "var(--text-muted)", textDecoration: "none" }}>
              {formatSongArtist(e.song)}
            </Link>
          </div>
          <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.prevPos ?? "—"}
          </div>
          <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.weeks}
          </div>
          <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)" }}>
            {e.peak}
          </div>
          <div style={{ fontSize: pointsSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent)", padding: "0 8px" }}>
            {e.points}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistsTable({ artists, viewSize, isMobile }: { artists: ArtistEntry[]; viewSize: "small" | "large"; isMobile: boolean }) {
  if (artists.length === 0) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 40, textAlign: "center" as const, color: "var(--text-muted)", fontSize: 14 }}>
        Nenhuma parada publicada esta semana ainda.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {artists.map((a) => {
          const palette = COVER_PALETTES[(a.position - 1) % COVER_PALETTES.length];
          return (
            <Link
              key={a.name}
              href={buildArtistPath(a.name, a.spotifyId)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: "1px solid var(--divider-soft)",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {/* Position + badge */}
              <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: a.position <= 3 ? 22 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {a.position}
                </div>
                <div style={{ marginTop: 2 }}>
                  <MovementBadge status={a.status} delta={a.delta} compact />
                </div>
              </div>

              {/* Avatar */}
              <div style={{ flexShrink: 0 }}>
                {a.imageUrl ? (
                  <img
                    src={a.imageUrl}
                    alt={a.name}
                    width={50}
                    height={50}
                    style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }}
                  />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`, boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
                )}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                  {a.chartCount} parada{a.chartCount !== 1 ? "s" : ""}
                </div>
              </div>

              {/* ANT · PICO · SEM */}
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <StatPill label="ANT" value={a.prevPos ?? "—"} />
                <StatPill label="PICO" value={a.peak} accent={a.peak === 1 ? "var(--accent)" : undefined} />
                <StatPill label="SEM" value={a.weeks} />
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const avatarCol = isLarge ? LARGE_COVER_SIZE + 20 : 76;
  const gridTemplateColumns = isLarge
    ? `80px ${avatarCol}px 120px minmax(0,1fr) 96px 96px 80px 130px`
    : "60px 76px 90px minmax(0,1fr) 80px 80px 70px 100px";
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const posSize = isLarge ? 28 : 20;
  const avatarSize = isLarge ? LARGE_COVER_SIZE : 60;
  const nameSize = isLarge ? 17 : 14;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;
  const growthSize = isLarge ? 15 : 13;
  const gridTemplateColumnsWithGrowth = `${gridTemplateColumns} 90px`;

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: gridTemplateColumnsWithGrowth,
        padding: isLarge ? "12px 24px" : "10px 20px",
        background: "var(--fill-inset)",
        borderBottom: "1px solid var(--divider)",
      }}>
        {["Pos", "", "Mudança", "Artista", "Semana ant.", "Sem.", "Pico", "Pontos", "Cresc."].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {artists.map((a) => {
        const palette = COVER_PALETTES[(a.position - 1) % COVER_PALETTES.length];
        return (
          <Link
            key={a.name}
            href={buildArtistPath(a.name, a.spotifyId)}
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplateColumnsWithGrowth,
              alignItems: "center",
              padding: rowPadding,
              borderBottom: "1px solid var(--divider-soft)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: posSize, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right" as const, paddingRight: 12, letterSpacing: "-0.02em" }}>
              {a.position}
            </div>
            <div style={{ padding: "6px 8px" }}>
              {a.imageUrl ? (
                <img src={a.imageUrl} alt={a.name} width={avatarSize} height={avatarSize} style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
              ) : (
                <div style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`, boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
              )}
            </div>
            <div style={{ padding: "0 8px" }}>
              <MovementBadge status={a.status} delta={a.delta} />
            </div>
            <div style={{ padding: "0 12px", minWidth: 0 }}>
              <div style={{ fontSize: nameSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {a.name}
              </div>
            </div>
            <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {a.prevPos ?? "—"}
            </div>
            <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {a.weeks}
            </div>
            <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)" }}>
              {a.peak}
            </div>
            <div style={{ fontSize: pointsSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent)", padding: "0 8px" }}>
              {a.totalPoints}
            </div>
            <div style={{ fontSize: growthSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: a.growthPct !== null && a.growthPct >= 0 ? "var(--up-fg)" : "var(--down-fg)" }}>
              {a.growthPct === null ? "—" : `${a.growthPct >= 0 ? "+" : ""}${a.growthPct.toFixed(1)}%`}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
