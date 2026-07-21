"use client";

import Link from "next/link";
import type { CriticsFMAlbum } from "@/lib/criticsfm-data";
import { ScoreSquare } from "@/components/ui/ScoreSquare";
import { useTranslations } from "@/hooks/useTranslations";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function TopAlbumCarouselCard({ album }: { album: CriticsFMAlbum }) {
  const { t } = useTranslations();
  const hue = albumHue(album.title);

  return (
    <Link
      href={`/criticsfm/${album.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", flexShrink: 0, width: 148 }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 14,
          overflow: "hidden",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1/1",
            position: "relative",
            background: album.coverUrl ? undefined : `hsl(${hue},45%,58%)`,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontSize: 44,
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

          <div style={{ position: "absolute", bottom: 8, left: 8 }}>
            <ScoreSquare score={album.score} size={30} overlay />
          </div>
        </div>

        <div style={{ padding: "9px 10px 10px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--text)",
            }}
          >
            {album.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {album.artist}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 3 }}>
            {t(
              album.reviewCount === 1 ? "criticsfm.reviewCountSingular" : "criticsfm.reviewCountPlural",
              { count: album.reviewCount },
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TopAlbumsSection({ albums }: { albums: CriticsFMAlbum[] }) {
  const { t } = useTranslations();
  if (albums.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {t("criticsfm.topRated")}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-disabled)", fontWeight: 400 }}>
          {t("criticsfm.minReviewsShort")}
        </span>
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
          {t("criticsfm.viewAllReviews")}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      <div
        style={{
          overflowX: "auto",
          display: "flex",
          gap: 10,
          paddingBottom: 4,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {albums.map((album) => (
          <TopAlbumCarouselCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
