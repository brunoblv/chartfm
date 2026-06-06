import Link from "next/link";
import type { CriticsFMAlbum } from "@/lib/criticsfm-data";
import { scoreColor } from "@/lib/album-score";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function TopAlbumCard({ album }: { album: CriticsFMAlbum }) {
  const hue = albumHue(album.title);
  const sc = scoreColor(album.score);

  return (
    <Link href={`/criticsfm/${album.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, display: "flex", alignItems: "center", gap: 14, padding: "12px 14px" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            flexShrink: 0,
            position: "relative",
            background: album.coverUrl ? undefined : `hsl(${hue},45%,55%)`,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontSize: 24,
            fontWeight: 800,
            overflow: "hidden",
          }}
        >
          {album.coverUrl ? (
            <img src={album.coverUrl} alt={album.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            album.title[0]?.toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
            {album.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {album.artist}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            {album.releaseDate && (
              <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>{album.releaseDate.slice(0, 4)}</span>
            )}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{album.reviewCount} reviews</span>
          </div>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: sc,
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            fontWeight: 800,
            color: "white",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {album.score}
        </div>
      </div>
    </Link>
  );
}

export function TopAlbumsSection({ albums }: { albums: CriticsFMAlbum[] }) {
  if (albums.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {albums.map((album) => (
          <TopAlbumCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
