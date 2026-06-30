"use client";

import { useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { COVER_PALETTES } from "@/lib/data";
import { formatSongArtist } from "@/lib/song-artist";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import {
  DESKTOP_COVER_SIZE,
  LARGE_COVER_SIZE,
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
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";
import type { Cover as CoverData } from "@/lib/types";
import type { GlobalPlaylistKind } from "@/lib/global-playlist-tracks";
import { GlobalSpotifyPlaylistButton } from "@/components/global/GlobalSpotifyPlaylistButton";
import Link from "next/link";
import { Star } from "lucide-react";

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
  numberOnes?: number;
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
  numberOnes?: number;
  growthPct: number | null;
  imageUrl?: string | null;
};

function StatPill({ label, value, accent, compact }: { label: string; value: number | string; accent?: string; compact?: boolean }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: accent ?? "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</div>
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
  spotifyPlaylist,
}: {
  weeklySongs: SongEntry[];
  weeklyArtists: ArtistEntry[];
  overallSongs: SongEntry[];
  overallArtists: ArtistEntry[];
  weeklyDropouts?: SongEntry[];
  spotifyPlaylist?: {
    kind: Extract<GlobalPlaylistKind, "global100" | "genre">;
    weekIndex: number;
    genreSlug?: string;
    returnPath: string;
  };
}) {
  const [tab, setTab] = useState<"songs" | "artists" | "saidas">("songs");
  const [viewSize, setViewSize] = useState<"small" | "large">("small");
  const [period, setPeriod] = useState<"weekly" | "overall">("weekly");
  const isMobile = useIsMobile(MOBILE_LIST_BREAKPOINT);
  const { t } = useTranslations();
  const songs = period === "weekly" ? weeklySongs : overallSongs;
  const artists = period === "weekly" ? weeklyArtists : overallArtists;

  return (
    <div style={isMobile ? { marginLeft: -16, marginRight: -16 } : undefined}>
      {/* Tab bar */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 10, marginBottom: 20 }}>
        {/* Main tab: Músicas / Artistas / Saídas */}
        <div style={{ ...segmentContainer, width: isMobile ? "100%" : "fit-content" }}>
          {(["songs", "artists", "saidas"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{ ...segmentBtn(tab === tabKey), flex: isMobile ? 1 : undefined, padding: isMobile ? "10px 0" : "8px 20px" }}
            >
              {isMobile
                ? (tabKey === "songs" ? t("global.songs") : tabKey === "artists" ? t("global.artists") : t("global.dropouts"))
                : (tabKey === "songs"
                  ? t("global.top100Songs")
                  : tabKey === "artists"
                    ? t("global.top100Artists")
                    : weeklyDropouts.length > 0
                      ? t("global.dropoutsCount", { count: weeklyDropouts.length })
                      : t("global.dropouts"))}
            </button>
          ))}
        </div>

        {tab !== "saidas" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {tab === "songs" && spotifyPlaylist && (
              <GlobalSpotifyPlaylistButton
                kind={spotifyPlaylist.kind}
                weekIndex={spotifyPlaylist.weekIndex}
                genreSlug={spotifyPlaylist.genreSlug}
                period={period}
                returnPath={spotifyPlaylist.returnPath}
              />
            )}
            {/* Period: Semanal / Overall */}
            <div style={{ ...segmentContainer, flex: isMobile ? 1 : undefined }}>
              <button onClick={() => setPeriod("weekly")} style={{ ...segmentBtnSm(period === "weekly"), flex: isMobile ? 1 : undefined }}>{t("global.weekly")}</button>
              <button onClick={() => setPeriod("overall")} style={{ ...segmentBtnSm(period === "overall"), flex: isMobile ? 1 : undefined }}>{t("global.overall")}</button>
            </div>

            {/* Size toggle: hidden on mobile */}
            {!isMobile && (
              <div style={segmentContainer}>
                <button onClick={() => setViewSize("small")} style={segmentBtnSm(viewSize === "small")}>{t("global.smaller")}</button>
                <button onClick={() => setViewSize("large")} style={segmentBtnSm(viewSize === "large")}>{t("global.larger")}</button>
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
  const { t } = useTranslations();
  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {songs.map((e) => (
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
              <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0, alignSelf: "flex-start" }}>
                <div style={{ fontSize: e.position <= 3 ? 20 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {e.position}
                </div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <MovementBadge status={e.status} delta={e.delta} compact />
                </div>
              </div>
              <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
                <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={MOBILE_COVER_SIZE} rounded={6} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: MOBILE_TITLE_SIZE, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "var(--text)" }}>
                  {e.song.title}
                </Link>
                <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: MOBILE_ARTIST_SIZE, lineHeight: 1.25, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", marginTop: 2 }}>
                  {formatSongArtist(e.song)}
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT, flexWrap: "wrap" as const }}>
              <StatPill compact label={t("global.colPeak")} value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill compact label={t("global.colWeeks")} value={e.weeks} />
              <StatPill compact label={t("global.colNumberOnes")} value={(e.numberOnes ?? 0) > 0 ? `${e.numberOnes}x` : "—"} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const coverCol = isLarge ? `${LARGE_COVER_SIZE + 20}px` : desktopCoverGridColumn(DESKTOP_COVER_SIZE);
  const gridTemplateColumns = desktopListGrid(
    coverCol,
    isLarge ? "96px 80px 50px 120px" : "80px 60px 50px 100px",
    isLarge,
  );
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const coverSize = isLarge ? LARGE_COVER_SIZE : DESKTOP_COVER_SIZE;
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
        {[t("global.colPos"), "", t("global.colSong"), t("global.colWeeks"), t("global.colPeak"), t("global.colNumberOnes"), t("global.colPoints"), t("global.colGrowth")].map((h, i) => (
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
          <DesktopPosCell position={e.position} large={isLarge}>
            <MovementBadge status={e.status} delta={e.delta} compact />
          </DesktopPosCell>
          <Link href={buildSongPath(e.song)} style={{ padding: "6px 8px", lineHeight: 0 }}>
            <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={coverSize} rounded={isLarge ? 14 : 10} />
          </Link>
          <div style={{ padding: "0 12px", minWidth: 0 }}>
            <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: titleSize, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit", textDecoration: "none" }}>
              {e.song.title}
            </Link>
            <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: artistSize, color: "var(--text-muted)", textDecoration: "none" }}>
              {formatSongArtist(e.song)}
            </Link>
          </div>
          <div style={{ fontSize: valueSize, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {e.weeks}
          </div>
          <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)", display: "flex", alignItems: "center", gap: 3 }}>
            {e.peak === 1 && (
              <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}>
                <Star size={12} color="currentColor" fill="currentColor" />
              </span>
            )}
            {e.peak}
          </div>
          <div style={{ fontSize: valueSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: (e.numberOnes ?? 0) > 0 ? "var(--text)" : "var(--text-disabled)" }}>
            {(e.numberOnes ?? 0) > 0 ? `${e.numberOnes}x` : "—"}
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
  const { t } = useTranslations();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", padding: "2px 7px", borderRadius: 6, background: "#1C1C1E", color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>
      {t("global.exited")}
    </span>
  );
}

function DropoutsGlobalTable({ songs, viewSize, isMobile }: { songs: SongEntry[]; viewSize: "small" | "large"; isMobile: boolean }) {
  const { t } = useTranslations();

  if (songs.length === 0) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 40, textAlign: "center" as const, color: "var(--text-muted)", fontSize: 14 }}>
        {t("global.noDropouts")}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {songs.map((e) => (
          <div key={e.position} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--divider-soft)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
              <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0, alignSelf: "flex-start" }}>
                <div style={{ fontSize: e.position <= 3 ? 20 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {e.position}
                </div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <ExitBadge />
                </div>
              </div>
              <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
                <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={MOBILE_COVER_SIZE} rounded={6} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: MOBILE_TITLE_SIZE, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "var(--text)" }}>
                  {e.song.title}
                </Link>
                <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: MOBILE_ARTIST_SIZE, lineHeight: 1.25, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", marginTop: 2 }}>
                  {formatSongArtist(e.song)}
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT, flexWrap: "wrap" as const }}>
              <StatPill compact label={t("global.colPeak")} value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill compact label={t("global.colWeeks")} value={e.weeks} />
              <StatPill compact label={t("global.colNumberOnes")} value={(e.numberOnes ?? 0) > 0 ? `${e.numberOnes}x` : "—"} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const coverCol = isLarge ? `${LARGE_COVER_SIZE + 20}px` : desktopCoverGridColumn(DESKTOP_COVER_SIZE);
  const gridCols = desktopListGrid(coverCol, isLarge ? "96px 96px 80px 50px 120px" : "80px 80px 60px 50px 100px", isLarge);
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
  const coverSize = isLarge ? LARGE_COVER_SIZE : DESKTOP_COVER_SIZE;
  const titleSize = isLarge ? 17 : 14;
  const artistSize = isLarge ? 14 : 12;
  const valueSize = isLarge ? 16 : 13;
  const pointsSize = isLarge ? 19 : 15;

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: isLarge ? "12px 24px" : "10px 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
        {[t("global.colPos"), "", t("global.colSong"), t("global.colPrevWeek"), t("global.colWeeks"), t("global.colPeak"), t("global.colNumberOnes"), t("global.colPoints")].map((h, i) => (
          <div key={i} style={{ fontSize: isLarge ? 12 : 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--text-muted)", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {songs.map((e) => (
        <div key={e.position} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: rowPadding, borderBottom: "1px solid var(--divider-soft)", gap: 0 }}>
          <DesktopPosCell position={e.position} muted large={isLarge}>
            <ExitBadge />
          </DesktopPosCell>
          <Link href={buildSongPath(e.song)} style={{ padding: "6px 8px", lineHeight: 0 }}>
            <Cover cover={e.cover} song={{ ...e.song, album: e.song.album ?? "" }} size={coverSize} rounded={isLarge ? 14 : 10} />
          </Link>
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
          <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)", display: "flex", alignItems: "center", gap: 3 }}>
            {e.peak === 1 && (
              <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}>
                <Star size={12} color="currentColor" fill="currentColor" />
              </span>
            )}
            {e.peak}
          </div>
          <div style={{ fontSize: valueSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: (e.numberOnes ?? 0) > 0 ? "var(--text)" : "var(--text-disabled)" }}>
            {(e.numberOnes ?? 0) > 0 ? `${e.numberOnes}x` : "—"}
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
  const { t } = useTranslations();
  if (artists.length === 0) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 40, textAlign: "center" as const, color: "var(--text-muted)", fontSize: 14 }}>
        {t("global.noChartsWeek")}
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
                flexDirection: "column",
                gap: 6,
                padding: "10px 12px",
                borderBottom: "1px solid var(--divider-soft)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
                <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0, alignSelf: "flex-start" }}>
                  <div style={{ fontSize: a.position <= 3 ? 20 : 16, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {a.position}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                    <MovementBadge status={a.status} delta={a.delta} compact />
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt={a.name}
                      width={MOBILE_COVER_SIZE}
                      height={MOBILE_COVER_SIZE}
                      style={{ width: MOBILE_COVER_SIZE, height: MOBILE_COVER_SIZE, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }}
                    />
                  ) : (
                    <div style={{ width: MOBILE_COVER_SIZE, height: MOBILE_COVER_SIZE, borderRadius: "50%", background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`, boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: MOBILE_TITLE_SIZE, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: MOBILE_ARTIST_SIZE, color: "var(--text-muted)", marginTop: 2 }}>
                    {a.chartCount} parada{a.chartCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT, flexWrap: "wrap" as const }}>
                <StatPill compact label={t("global.colPrevShort")} value={a.prevPos ?? "—"} />
                <StatPill compact label={t("global.colPeak")} value={a.peak} accent={a.peak === 1 ? "var(--accent)" : undefined} />
                <StatPill compact label={t("global.colWeeks")} value={a.weeks} />
                <StatPill compact label={t("global.colNumberOnes")} value={(a.numberOnes ?? 0) > 0 ? `${a.numberOnes}x` : "—"} />
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  const isLarge = viewSize === "large";
  const avatarCol = isLarge ? `${LARGE_COVER_SIZE + 20}px` : desktopCoverGridColumn(60);
  const gridTemplateColumns = desktopListGrid(
    avatarCol,
    isLarge ? "96px 96px 80px 50px 130px" : "80px 80px 70px 50px 100px",
    isLarge,
  );
  const rowPadding = isLarge ? "14px 24px" : "8px 20px";
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
        {[t("global.colPos"), "", t("global.colArtist"), t("global.colPrevWeek"), t("global.colWeeks"), t("global.colPeak"), t("global.colNumberOnes"), t("global.colPoints"), t("global.colGrowth")].map((h, i) => (
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
            <DesktopPosCell position={a.position} large={isLarge}>
              <MovementBadge status={a.status} delta={a.delta} compact />
            </DesktopPosCell>
            <div style={{ padding: "6px 8px" }}>
              {a.imageUrl ? (
                <img src={a.imageUrl} alt={a.name} width={avatarSize} height={avatarSize} style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
              ) : (
                <div style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`, boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }} />
              )}
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
            <div style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: "var(--text)", display: "flex", alignItems: "center", gap: 3 }}>
              {a.peak === 1 && (
                <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}>
                  <Star size={12} color="currentColor" fill="currentColor" />
                </span>
              )}
              {a.peak}
            </div>
            <div style={{ fontSize: valueSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 8px", color: (a.numberOnes ?? 0) > 0 ? "var(--text)" : "var(--text-disabled)" }}>
              {(a.numberOnes ?? 0) > 0 ? `${a.numberOnes}x` : "—"}
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
