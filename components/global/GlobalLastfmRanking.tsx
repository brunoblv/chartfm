"use client";

import Link from "next/link";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import { formatSongArtist } from "@/lib/song-artist";
import { buildAlbumPath, buildArtistPath, buildSongPath } from "@/lib/music-routes";
import {
  DESKTOP_COVER_SIZE,
  MOBILE_ARTIST_SIZE,
  MOBILE_COVER_SIZE,
  MOBILE_LIST_BREAKPOINT,
  MOBILE_POS_WIDTH,
  MOBILE_ROW_GAP,
  MOBILE_STATS_INDENT,
  MOBILE_TITLE_SIZE,
  desktopCoverGridColumn,
  desktopListGrid,
} from "@/lib/chart-list-layout";
import type { GlobalLastfmEntry } from "@/lib/global-lastfm-ranking";

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
  entries: GlobalLastfmEntry[];
  mode: "airplay" | "albums";
  emptyMessage: string;
};

export function GlobalLastfmRanking({ entries, mode, emptyMessage }: Props) {
  const isMobile = useIsMobile(MOBILE_LIST_BREAKPOINT);
  const { t } = useTranslations();

  if (!entries.length) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: "32px 24px",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  function itemHref(entry: GlobalLastfmEntry) {
    if (mode === "albums") {
      return buildAlbumPath(entry.song.title, entry.song.artist);
    }
    return buildSongPath(entry.song);
  }

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 0,
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          overflow: "hidden",
          marginLeft: -16,
          marginRight: -16,
        }}
      >
        {entries.map((e) => (
          <div
            key={e.position}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 12px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
              <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: e.position <= 3 ? 20 : 16,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {e.position}
                </div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <MovementBadge status={e.status} delta={e.delta} compact />
                </div>
              </div>
              <Link href={itemHref(e)} style={{ lineHeight: 0, flexShrink: 0 }}>
                <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={MOBILE_COVER_SIZE} rounded={6} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={itemHref(e)}
                  style={{
                    display: "block",
                    fontSize: MOBILE_TITLE_SIZE,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {e.song.title}
                </Link>
                <Link
                  href={buildArtistPath(e.song.artist, e.song.artistSpotifyId)}
                  style={{
                    display: "block",
                    fontSize: MOBILE_ARTIST_SIZE,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {formatSongArtist(e.song)}
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT, flexWrap: "wrap" }}>
              <StatPill compact label={t("global.colPeak")} value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill compact label={t("global.colWeeks")} value={e.weeks} />
              <StatPill compact label={t("global.colPoints")} value={e.points} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const gridTemplateColumns = desktopListGrid(
    desktopCoverGridColumn(DESKTOP_COVER_SIZE),
    "80px 60px 50px 100px",
    false,
  );

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          padding: "10px 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[t("global.colPos"), "", mode === "albums" ? "Álbum" : t("global.colSong"), t("global.colWeeks"), t("global.colPeak"), t("global.colPoints")].map(
          (h, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "6px 8px",
              }}
            >
              {h}
            </div>
          ),
        )}
      </div>
      {entries.map((e) => (
        <div
          key={e.position}
          style={{
            display: "grid",
            gridTemplateColumns,
            alignItems: "center",
            padding: "8px 20px",
            borderBottom: "1px solid var(--divider-soft)",
          }}
        >
          <DesktopPosCell position={e.position}>
            <MovementBadge status={e.status} delta={e.delta} compact />
          </DesktopPosCell>
          <Link href={itemHref(e)} style={{ lineHeight: 0 }}>
            <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={DESKTOP_COVER_SIZE} rounded={8} />
          </Link>
          <div style={{ minWidth: 0, padding: "0 8px" }}>
            <Link
              href={itemHref(e)}
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "none",
                color: "var(--text)",
              }}
            >
              {e.song.title}
            </Link>
            <Link
              href={buildArtistPath(e.song.artist, e.song.artistSpotifyId)}
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "none",
                marginTop: 2,
              }}
            >
              {formatSongArtist(e.song)}
            </Link>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, padding: "0 8px" }}>{e.weeks}</div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, padding: "0 8px", color: e.peak === 1 ? "var(--accent)" : "var(--text)" }}>
            {e.peak}
          </div>
          <div style={{ textAlign: "right", fontSize: 15, fontWeight: 800, padding: "0 8px", fontVariantNumeric: "tabular-nums" }}>
            {e.points}
          </div>
        </div>
      ))}
    </div>
  );
}
