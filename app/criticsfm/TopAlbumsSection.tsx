"use client";

import Link from "next/link";
import type { CriticsFMAlbum } from "@/lib/criticsfm-data";
import { scoreColor } from "@/lib/album-score";
import { useIsMobile } from "@/hooks/useIsMobile";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function TopAlbumCard({ album }: { album: CriticsFMAlbum }) {
  const hue = albumHue(album.title);
  const sc = scoreColor(album.score);

  return (
    <Link href={`/criticsfm/${album.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 16,
          overflow: "hidden",
          transition: "box-shadow 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1/1",
            position: "relative",
            background: album.coverUrl ? undefined : `hsl(${hue},45%,55%)`,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={album.title}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            album.title[0]?.toUpperCase()
          )}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              width: 40,
              height: 40,
              borderRadius: 10,
              background: sc,
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              fontWeight: 800,
              color: "white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {album.score}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 10,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              color: "white",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {album.reviewCount} reviews
          </div>
        </div>
        <div style={{ padding: "12px 14px 14px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--text)",
            }}
          >
            {album.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {album.artist}
          </div>
          {album.releaseDate && (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 6 }}>
              {album.releaseDate.slice(0, 4)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function TopAlbumsSection({ albums }: { albums: CriticsFMAlbum[] }) {
  const isMobile = useIsMobile();

  if (albums.length === 0) return null;

  return (
    <div style={{ marginTop: isMobile ? 32 : 48 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Melhores avaliados
        </div>
        <span style={{ fontSize: 12, color: "var(--text-disabled)", fontWeight: 400 }}>mínimo 2 reviews</span>
        <div style={{ flex: 1 }} />
        <Link
          href="/criticsfm/reviews"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          Ver todos os reviews
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(158px, 1fr))",
          gap: 16,
        }}
      >
        {albums.map((album) => (
          <TopAlbumCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
