"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { VideoClipCover } from "@/components/ui/VideoClipCover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import {
  MOBILE_ARTIST_SIZE,
  MOBILE_LIST_BREAKPOINT,
  MOBILE_POS_WIDTH,
  MOBILE_ROW_GAP,
  MOBILE_STATS_INDENT,
  MOBILE_TITLE_SIZE,
  desktopListGrid,
} from "@/lib/chart-list-layout";
import { useIsMobile } from "@/hooks/useIsMobile";

function entryToSong(e: MyTrlChartEntry) {
  return {
    title: e.track,
    artist: e.artist,
    album: e.album,
    spotifyId: e.spotifyId,
    artistSpotifyId: null as string | null,
    artistRefId: null as number | null,
    albumRefId: null as number | null,
  };
}

function entryPalette(e: MyTrlChartEntry) {
  const seed = e.track.length + e.artist.length;
  return { paletteA: "#FF6B6B", paletteB: "#FFE66D", seed };
}

function StatPill({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: number | string;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontSize: compact ? 8 : 9,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: compact ? 12 : 14,
          fontWeight: 700,
          color: accent ?? "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

type Props = {
  entries: MyTrlChartEntry[];
  videoClips: Record<string, string>;
  compact?: boolean;
  preview?: boolean;
  maxEntries?: number;
};

export function MyTrlVideoClipList({
  entries,
  videoClips,
  compact = false,
  preview = false,
  maxEntries,
}: Props) {
  const isMobile = useIsMobile(MOBILE_LIST_BREAKPOINT);
  const visibleEntries = maxEntries ? entries.slice(0, maxEntries) : entries;
  const isPreview = preview || compact;
  const clipHeight = isPreview ? (isMobile ? 52 : 64) : isMobile ? 56 : 125;
  const clipWidth = Math.round(clipHeight * (16 / 9));
  const mobileClipIndent = MOBILE_POS_WIDTH + MOBILE_ROW_GAP + clipWidth + MOBILE_ROW_GAP;
  const gridColumns = desktopListGrid(`${clipWidth + 16}px`, "72px 56px 56px 72px");

  if (visibleEntries.length === 0) {
    return (
      <div style={{ padding: isPreview ? 20 : 32, textAlign: "center", color: "var(--text-muted)", fontSize: isPreview ? 13 : 14 }}>
        Nenhuma música nesta edição.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: isPreview ? 12 : 0,
          border: isPreview ? "1px solid var(--divider)" : undefined,
          borderTop: isPreview ? undefined : "1px solid var(--divider)",
          borderBottom: isPreview ? undefined : "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        {visibleEntries.map((e) => {
          const song = entryToSong(e);
          const { paletteA, paletteB, seed } = entryPalette(e);
          const clipUrl = e.spotifyId ? videoClips[e.spotifyId] ?? null : null;
          return (
            <div
              key={e.position}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: isPreview ? "8px 10px" : "10px 12px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
                <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: e.position <= 3 ? 20 : 16,
                      fontWeight: 800,
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}
                  >
                    {e.position}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                    <MovementBadge status={e.status} delta={e.delta} compact />
                  </div>
                </div>
                <Link href={e.spotifyId ? buildSongPath(song) : "#"} style={{ lineHeight: 0, flexShrink: 0 }}>
                  <VideoClipCover
                    imageUrl={clipUrl}
                    paletteA={paletteA}
                    paletteB={paletteB}
                    seed={seed}
                    height={clipHeight}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={e.spotifyId ? buildSongPath(song) : "#"}
                    style={{
                      display: "block",
                      fontSize: isPreview ? 12 : MOBILE_TITLE_SIZE,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      color: "var(--text)",
                    }}
                  >
                    {e.track}
                  </Link>
                  <Link
                    href={buildArtistPath(e.artist, null, null)}
                    style={{
                      display: "block",
                      fontSize: isPreview ? 10 : MOBILE_ARTIST_SIZE,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      marginTop: 2,
                    }}
                  >
                    {formatSongArtist(song)}
                  </Link>
                </div>
              </div>
              {(!isPreview || preview) && (
                <div style={{ display: "flex", gap: 8, paddingLeft: mobileClipIndent }}>
                  <StatPill compact label="ANT" value={e.prevPos ?? "—"} />
                  <StatPill compact label="PICO" value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
                  <StatPill compact label="DIAS" value={e.weeks} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (isPreview) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visibleEntries.map((e) => {
          const song = entryToSong(e);
          const { paletteA, paletteB, seed } = entryPalette(e);
          const clipUrl = e.spotifyId ? videoClips[e.spotifyId] ?? null : null;
          return (
            <div
              key={e.position}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 12px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14, textAlign: "center", color: e.position <= 3 ? "var(--accent)" : "var(--text)" }}>
                {e.position}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.track}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {formatSongArtist(song)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{e.weeks}d</span>
                <MovementBadge status={e.status} delta={e.delta} compact />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {["Pos", "", "Música", "Anterior", "Dias", "Pico", "#1s"].map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {visibleEntries.map((e) => {
        const song = entryToSong(e);
        const { paletteA, paletteB, seed } = entryPalette(e);
        const clipUrl = e.spotifyId ? videoClips[e.spotifyId] ?? null : null;

        return (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              alignItems: "stretch",
              padding: "8px 20px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <DesktopPosCell position={e.position} alignSelf="center">
              <MovementBadge status={e.status} delta={e.delta} compact />
            </DesktopPosCell>
            <Link href={e.spotifyId ? buildSongPath(song) : "#"} style={{ padding: "4px 8px 4px 0", lineHeight: 0, alignSelf: "center" }}>
              <VideoClipCover imageUrl={clipUrl} paletteA={paletteA} paletteB={paletteB} seed={seed} height={clipHeight} />
            </Link>
            <div style={{ minWidth: 0, padding: "0 12px", alignSelf: "center" }}>
              <Link
                href={e.spotifyId ? buildSongPath(song) : "#"}
                style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
              >
                {e.track}
              </Link>
              <Link
                href={buildArtistPath(e.artist, null, null)}
                style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
              >
                {formatSongArtist(song)}
              </Link>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px", alignSelf: "center" }}>
              {e.prevPos ?? "—"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px", alignSelf: "center" }}>
              {e.weeks}
            </div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", padding: "0 8px", display: "flex", alignItems: "center", gap: 3, alignSelf: "center" }}>
              {e.peak === 1 && <Star size={12} color="var(--accent)" fill="var(--accent)" />}
              {e.peak}
            </div>
            <div style={{ padding: "0 8px", alignSelf: "center", fontSize: 13, fontWeight: e.numberOnes > 0 ? 700 : 400, color: e.numberOnes > 0 ? "var(--text)" : "var(--text-disabled)" }}>
              {e.numberOnes > 0 ? `${e.numberOnes}x` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
