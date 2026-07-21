"use client";

import { useState } from "react";
import type { WeeklyReleaseData, WeeklyReleaseAlbumInfo } from "@/lib/weekly-releases";
import { useTranslations } from "@/hooks/useTranslations";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function MiniCover({ title, coverUrl }: { title: string; coverUrl?: string | null }) {
  const size = 48;
  if (coverUrl) {
    return <img src={coverUrl} alt={title} style={{ width: size, height: size, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />;
  }
  const hue = albumHue(title);
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: `hsl(${hue},45%,55%)`, display: "grid", placeItems: "center", color: "white", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
      {title[0]?.toUpperCase()}
    </div>
  );
}

function WeekRow({ release }: { release: WeeklyReleaseData }) {
  const { t } = useTranslations();
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {t("criticsfm.weekOfLabel", { week: release.weekLabel })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {release.albums.map((album) => (
          <div key={album.albumId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MiniCover title={album.title} coverUrl={album.coverUrl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{album.artist} · {album.year}</div>
            </div>
            {album.spotifyUrl && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, fontWeight: 700, color: "#1DB954", textDecoration: "none", flexShrink: 0 }}
              >
                {t("criticsfm.spotifyLinkLabel")}
              </a>
            )}
          </div>
        ))}
        {release.albums.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("criticsfm.noAlbumsRegistered")}</div>
        )}
      </div>
    </div>
  );
}

export function LancamentosHistorico({ history }: { history: WeeklyReleaseData[] }) {
  const { t } = useTranslations();
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? history.filter((r) => {
        const term = q.toLowerCase();
        return (
          r.weekLabel.toLowerCase().includes(term) ||
          r.albums.some(
            (a) =>
              a.title.toLowerCase().includes(term) ||
              a.artist.toLowerCase().includes(term),
          )
        );
      })
    : history;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("criticsfm.searchByWeekAlbumArtist")}
        style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--divider-strong)", fontSize: 14, fontFamily: "inherit", background: "var(--fill-inset)", color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box" }}
      />

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: 40 }}>
          {history.length === 0 ? t("criticsfm.noHistoryYet") : t("criticsfm.noWeekFound")}
        </div>
      )}

      {filtered.map((r) => (
        <WeekRow key={r.id} release={r} />
      ))}
    </div>
  );
}
