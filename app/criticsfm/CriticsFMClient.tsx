"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CriticsFMAlbum } from "./page";
import { scoreColor, scoreBg, scoreLabel } from "@/lib/album-score";

const SORT_OPTIONS = [
  { id: "recent", label: "Recentes" },
  { id: "score", label: "Melhor score" },
  { id: "reviews", label: "Mais reviews" },
] as const;
type SortId = (typeof SORT_OPTIONS)[number]["id"];

type ScoreFilter =
  | "all"
  | "acclaimed"
  | "excellent"
  | "good"
  | "mixed"
  | "weak"
  | "unrated";

const SCORE_FILTERS: { id: ScoreFilter; label: string; color?: string }[] = [
  { id: "all", label: "Todos" },
  { id: "acclaimed", label: "Aclamado 90+", color: "#1B873F" },
  { id: "excellent", label: "Excelente 75+", color: "#1B873F" },
  { id: "good", label: "Bom 60+", color: "#2E7D32" },
  { id: "mixed", label: "Misto 50+", color: "#E09F00" },
  { id: "weak", label: "Fraco −49", color: "#C5291C" },
  { id: "unrated", label: "Sem nota" },
];

const PAGE_SIZE = 12;

function matchesScoreFilter(a: CriticsFMAlbum, f: ScoreFilter): boolean {
  if (f === "all") return true;
  if (f === "unrated") return a.reviewCount === 0;
  if (f === "acclaimed") return a.score >= 90 && a.reviewCount > 0;
  if (f === "excellent") return a.score >= 75 && a.score < 90 && a.reviewCount > 0;
  if (f === "good") return a.score >= 60 && a.score < 75 && a.reviewCount > 0;
  if (f === "mixed") return a.score >= 50 && a.score < 60 && a.reviewCount > 0;
  if (f === "weak") return a.score < 50 && a.reviewCount > 0;
  return true;
}

function AlbumCover({ coverUrl, title, size = 56 }: { coverUrl: string | null; title: string; size?: number }) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0, display: "block" }}
      />
    );
  }
  const hue = Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: `hsl(${hue},50%,60%)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        color: "white",
        fontSize: size * 0.36,
        fontWeight: 800,
      }}
    >
      {title[0]?.toUpperCase()}
    </div>
  );
}

function CriticsFMGridCard({ album }: { album: CriticsFMAlbum }) {
  return (
    <Link
      href={`/criticsfm/${album.id}`}
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.06)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `hsl(${Math.abs(album.title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360},50%,60%)`,
              display: "grid",
              placeItems: "center",
              color: "white",
              fontSize: 48,
              fontWeight: 800,
            }}
          >
            {album.title[0]?.toUpperCase()}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 10, left: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: album.reviewCount > 0 ? scoreColor(album.score) : "rgba(0,0,0,0.55)",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {album.reviewCount > 0 ? album.score : "—"}
          </div>
        </div>
        {album.reviewCount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 10,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              color: "white",
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {album.reviewCount} {album.reviewCount === 1 ? "review" : "reviews"}
          </div>
        )}
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
          }}
        >
          {album.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#86868B",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {album.artist}
        </div>
        {album.releaseDate && (
          <div style={{ fontSize: 11, color: "#AEAEB2", marginTop: 6 }}>
            {album.releaseDate.slice(0, 4)}
            {album.albumType && (
              <span> · {album.albumType === "ALBUM" ? "LP" : album.albumType}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function CriticsFMClient({ albums }: { albums: CriticsFMAlbum[] }) {
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [sortBy, setSortBy] = useState<SortId>("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [scoreFilter, sortBy, search]);

  const filtered = useMemo(() => {
    let list = albums.filter((a) => {
      if (!matchesScoreFilter(a, scoreFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.artist.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "score") list = [...list].sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount);
    else if (sortBy === "reviews") list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    else list = [...list].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
    return list;
  }, [albums, scoreFilter, sortBy, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const topAlbums = useMemo(
    () =>
      albums
        .filter((a) => a.reviewCount > 0)
        .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount)
        .slice(0, 5),
    [albums],
  );

  const showTop = scoreFilter === "all" && !search;

  return (
    <div>
      {/* Top Albums Showcase */}
      {showTop && topAlbums.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#86868B",
              marginBottom: 16,
            }}
          >
            Melhores avaliados
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {topAlbums.map((a) => (
              <Link
                key={a.id}
                href={`/criticsfm/${a.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    background: "white",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.06)",
                    padding: "12px 14px",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
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
                  <AlbumCover coverUrl={a.coverUrl} title={a.title} size={52} />
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 11,
                      background: scoreBg(a.score),
                      color: scoreColor(a.score),
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                      border: `1.5px solid ${scoreColor(a.score)}30`,
                    }}
                  >
                    {a.score}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#1D1D1F",
                      }}
                    >
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#86868B", marginTop: 2 }}>{a.artist}</div>
                    <div style={{ fontSize: 10, color: "#AEAEB2", marginTop: 3 }}>
                      {a.reviewCount} {a.reviewCount === 1 ? "review" : "reviews"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
          paddingBottom: 20,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <input
          type="text"
          placeholder="Buscar álbum ou artista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "9px 16px",
            borderRadius: 100,
            border: "1px solid rgba(0,0,0,0.1)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            background: "white",
            width: 220,
          }}
        />

        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setScoreFilter(f.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 100,
                border: "none",
                background: scoreFilter === f.id ? "#1D1D1F" : "rgba(0,0,0,0.05)",
                color: scoreFilter === f.id ? "white" : f.color ?? "#1D1D1F",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(0,0,0,0.04)",
            padding: 3,
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                background: sortBy === s.id ? "white" : "transparent",
                color: sortBy === s.id ? "#1D1D1F" : "#86868B",
                cursor: "pointer",
                boxShadow: sortBy === s.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: "#86868B", marginBottom: 16 }}>
        {filtered.length} {filtered.length === 1 ? "álbum" : "álbuns"}
      </div>

      {/* Album grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: "white",
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.06)",
            padding: 48,
            textAlign: "center",
            color: "#86868B",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhum álbum encontrado</div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 16,
            }}
          >
            {paginated.map((a) => (
              <CriticsFMGridCard key={a.id} album={a} />
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 28,
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: "8px 20px",
                  borderRadius: 100,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: page === 0 ? "rgba(0,0,0,0.04)" : "white",
                  color: page === 0 ? "#86868B" : "#1D1D1F",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: page === 0 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Anterior
              </button>
              <span style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={{
                  padding: "8px 20px",
                  borderRadius: 100,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: page === totalPages - 1 ? "rgba(0,0,0,0.04)" : "white",
                  color: page === totalPages - 1 ? "#86868B" : "#1D1D1F",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: page === totalPages - 1 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Próximo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
