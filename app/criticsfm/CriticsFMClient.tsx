"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CriticsFMAlbum } from "./page";
import { scoreColor, scoreBg, scoreLabel } from "@/lib/album-score";

type SpotifySearchHit = {
  spotifyId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  albumType: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  dbId: number | null;
  inDb: boolean;
};

function SpotifySearchPanel({ onClose, initialQuery = "" }: { onClose: () => void; initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SpotifySearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/criticsfm/search-spotify?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json() as { results: SpotifySearchHit[] };
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  async function handleAdd(hit: SpotifySearchHit) {
    if (hit.inDb && hit.dbId) { router.push(`/criticsfm/${hit.dbId}`); return; }
    setAdding(hit.spotifyId);
    try {
      const res = await fetch("/api/criticsfm/search-spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyAlbumId: hit.spotifyId }),
      });
      if (!res.ok) throw new Error("Falha ao adicionar");
      const data = await res.json() as { id: number };
      router.push(`/criticsfm/${data.id}`);
    } catch {
      setAdding(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 80,
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          width: "100%",
          maxWidth: 560,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F" }}>Buscar no Spotify</span>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#86868B", fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: "14px 20px" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nome do álbum ou artista…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.1)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              background: "#F5F5F7",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto", padding: "0 12px 16px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#86868B", fontSize: 13 }}>
              Buscando…
            </div>
          )}
          {!loading && q.trim() && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#86868B", fontSize: 13 }}>
              Nenhum resultado encontrado.
            </div>
          )}
          {!loading && results.map((hit) => (
            <div
              key={hit.spotifyId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 8px",
                borderRadius: 12,
                borderBottom: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              {hit.coverUrl ? (
                <img src={hit.coverUrl} alt={hit.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "#E5E5EA", flexShrink: 0, display: "grid", placeItems: "center", color: "#86868B", fontSize: 18, fontWeight: 700 }}>
                  {hit.title[0]?.toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {hit.title}
                </div>
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>{hit.artist}</div>
                <div style={{ fontSize: 11, color: "#AEAEB2", marginTop: 2 }}>
                  {hit.releaseDate?.slice(0, 4)}
                  {hit.albumType && <span> · {hit.albumType === "ALBUM" ? "LP" : hit.albumType}</span>}
                </div>
              </div>
              <button
                onClick={() => handleAdd(hit)}
                disabled={adding === hit.spotifyId}
                style={{
                  padding: "7px 16px",
                  borderRadius: 100,
                  border: "none",
                  background: hit.inDb ? "rgba(0,0,0,0.06)" : "#1D1D1F",
                  color: hit.inDb ? "#1D1D1F" : "white",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: adding === hit.spotifyId ? "default" : "pointer",
                  flexShrink: 0,
                  opacity: adding === hit.spotifyId ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {adding === hit.spotifyId ? "…" : hit.inDb ? "Ver" : "Adicionar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const [spotifyPanelQuery, setSpotifyPanelQuery] = useState<string | null>(null);
  const autoOpenedForRef = useRef<string | null>(null);

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

  useEffect(() => {
    const term = search.trim();
    if (term && filtered.length === 0 && autoOpenedForRef.current !== term) {
      autoOpenedForRef.current = term;
      setSpotifyPanelQuery(term);
    } else if (!term || filtered.length > 0) {
      autoOpenedForRef.current = null;
    }
  }, [search, filtered.length]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const topAlbums = useMemo(
    () =>
      albums
        .filter((a) => a.reviewCount > 1)
        .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount)
        .slice(0, 5),
    [albums],
  );

  const showTop = scoreFilter === "all" && !search;

  return (
    <div>
      {spotifyPanelQuery !== null && (
        <SpotifySearchPanel
          onClose={() => setSpotifyPanelQuery(null)}
          initialQuery={spotifyPanelQuery}
        />
      )}

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

        <button
          onClick={() => setSpotifyPanelQuery("")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 100,
            border: "none",
            background: "#1DB954",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "inherit",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Adicionar álbum
        </button>
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum álbum encontrado</div>
          {search && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#AEAEB2", marginBottom: 12 }}>
                Quer adicionar este álbum ao catálogo?
              </div>
              <button
                onClick={() => setSpotifyPanelQuery(search)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 20px",
                  borderRadius: 100,
                  border: "none",
                  background: "#1DB954",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Buscar no Spotify
              </button>
            </div>
          )}
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
