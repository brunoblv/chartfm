"use client";

import type { WeeklyReleaseData, WeeklyReleaseAlbumInfo } from "@/lib/weekly-releases";
import { AlbumQuickRating } from "./AlbumQuickRating";
import { useTranslations } from "@/hooks/useTranslations";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function AlbumCover({ title, coverUrl, size = 140 }: { title: string; coverUrl?: string | null; size?: number }) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        style={{ width: size, height: size, borderRadius: 16, objectFit: "cover", display: "block", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}
      />
    );
  }
  const hue = albumHue(title);
  return (
    <div style={{ width: size, height: size, borderRadius: 16, background: `hsl(${hue},45%,55%)`, display: "grid", placeItems: "center", color: "white", fontSize: Math.floor(size * 0.35), fontWeight: 800, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", userSelect: "none" }}>
      {title[0]?.toUpperCase()}
    </div>
  );
}

function SpotifyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color: "#1DB954" }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function AlbumCard({ album }: { album: WeeklyReleaseAlbumInfo }) {
  const { t } = useTranslations();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 20, background: "var(--surface)", borderRadius: 20, border: "1px solid var(--divider)", textAlign: "center" }}>
      <AlbumCover title={album.title} coverUrl={album.coverUrl} size={140} />
      <div style={{ minWidth: 0, width: "100%" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.artist}</div>
        <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 2 }}>{album.year}</div>
      </div>
      <AlbumQuickRating albumId={album.albumId} />
      {album.spotifyUrl && (
        <a
          href={album.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, background: "#1DB954", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
        >
          <SpotifyIcon size={13} />
          {t("criticsfm.listenOnSpotify")}
        </a>
      )}
    </div>
  );
}

export function LancamentosDaSemana({ release }: { release: WeeklyReleaseData | null }) {
  const { t } = useTranslations();
  if (!release) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 20, border: "1px solid var(--divider)", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("criticsfm.noReleaseWeekShort")}</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("criticsfm.featuredAlbumsWillAppear")}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {t("criticsfm.weekOfLabel", { week: release.weekLabel })}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {t(
            release.albums.length === 1 ? "criticsfm.albumsToListenSingular" : "criticsfm.albumsToListenPlural",
            { count: release.albums.length },
          )}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {release.albums.map((album) => (
          <AlbumCard key={album.albumId} album={album} />
        ))}
      </div>
    </div>
  );
}
