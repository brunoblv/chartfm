import Link from "next/link";
import type { WeeklyReleaseData } from "@/lib/weekly-releases";

export function WeeklyReleaseBanner({ release }: { release: WeeklyReleaseData }) {
  const previewAlbums = release.albums.slice(0, 4);

  return (
    <Link
      href="/criticsfm/lancamentos"
      style={{ display: "block", textDecoration: "none", marginBottom: 24 }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color 0.15s" }}>
        <div style={{ display: "flex", gap: -8, flexShrink: 0 }}>
          {previewAlbums.map((album, i) => (
            album.coverUrl ? (
              <img
                key={album.albumId}
                src={album.coverUrl}
                alt={album.title}
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", marginLeft: i > 0 ? -10 : 0, border: "2px solid var(--surface)", flexShrink: 0 }}
              />
            ) : (
              <div
                key={album.albumId}
                style={{ width: 40, height: 40, borderRadius: 8, background: "var(--fill-inset)", marginLeft: i > 0 ? -10 : 0, border: "2px solid var(--surface)", flexShrink: 0 }}
              />
            )
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Lançamentos da semana de {release.weekLabel}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {release.albums.length} álbum{release.albums.length !== 1 ? "s" : ""} para ouvir · Clique para ver
          </div>
        </div>
        <div style={{ fontSize: 18, color: "var(--text-muted)", flexShrink: 0 }}>→</div>
      </div>
    </Link>
  );
}
