"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CriticsFMAlbum } from "@/lib/criticsfm-data";
import { scoreColor, scoreBg } from "@/lib/album-score";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AdSlot } from "@/components/ui/AdSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── SpotifySearchPanel (unchanged) ──────────────────────────────────────────

function SpotifySearchPanel({ onClose, initialQuery = "" }: { onClose: () => void; initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SpotifySearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "48px 12px 0", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 20, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Buscar no Spotify</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: "14px 20px" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nome do álbum ou artista…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--divider-strong)", fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--fill-inset)", color: "var(--text)", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", padding: "0 12px 16px" }}>
          {loading && <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Buscando…</div>}
          {!loading && q.trim() && results.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Nenhum resultado encontrado.</div>}
          {!loading && results.map((hit) => (
            <div key={hit.spotifyId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: 12, borderBottom: "1px solid var(--divider-soft)" }}>
              {hit.coverUrl
                ? <img src={hit.coverUrl} alt={hit.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--fill-subtle)", flexShrink: 0, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 18, fontWeight: 700 }}>{hit.title[0]?.toUpperCase()}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{hit.artist}</div>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 2 }}>
                  {hit.releaseDate?.slice(0, 4)}
                  {hit.albumType && <span> · {hit.albumType === "ALBUM" ? "LP" : hit.albumType}</span>}
                </div>
              </div>
              <button
                onClick={() => handleAdd(hit)}
                disabled={adding === hit.spotifyId}
                style={{ padding: "7px 16px", borderRadius: 100, border: "none", background: hit.inDb ? "var(--fill-subtle)" : "var(--btn-dark-bg)", color: hit.inDb ? "var(--text)" : "var(--btn-dark-fg)", fontSize: 12, fontWeight: 600, cursor: adding === hit.spotifyId ? "default" : "pointer", flexShrink: 0, opacity: adding === hit.spotifyId ? 0.6 : 1, fontFamily: "inherit" }}
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: "recent",  label: "Recentes",     short: "Recentes" },
  { id: "score",   label: "Melhor score", short: "Score"    },
  { id: "reviews", label: "Mais reviews", short: "Reviews"  },
] as const;
type SortId = (typeof SORT_OPTIONS)[number]["id"];

type ScoreFilter = "all" | "acclaimed" | "recommended" | "mixed" | "unfavorable" | "rejected" | "unrated";

const SCORE_FILTERS: { id: ScoreFilter; label: string }[] = [
  { id: "all",          label: "Todos"                    },
  { id: "acclaimed",    label: "Aclamação universal 90+"  },
  { id: "recommended",  label: "Muito recomendado 70+"    },
  { id: "mixed",        label: "Recepção mista 50+"       },
  { id: "unfavorable",  label: "Desfavorável 30+"         },
  { id: "rejected",     label: "Repúdio generalizado"     },
  { id: "unrated",      label: "Sem nota"                 },
];

const PAGE_SIZE = 16;

function matchesScoreFilter(a: CriticsFMAlbum, f: ScoreFilter): boolean {
  if (f === "all")         return true;
  if (f === "unrated")     return a.reviewCount === 0;
  if (f === "acclaimed")   return a.score >= 90 && a.reviewCount > 0;
  if (f === "recommended") return a.score >= 70 && a.score < 90 && a.reviewCount > 0;
  if (f === "mixed")       return a.score >= 50 && a.score < 70 && a.reviewCount > 0;
  if (f === "unfavorable") return a.score >= 30 && a.score < 50 && a.reviewCount > 0;
  if (f === "rejected")    return a.score < 30 && a.reviewCount > 0;
  return true;
}

// ─── AlbumCover ───────────────────────────────────────────────────────────────

function AlbumCover({ coverUrl, title, size = 56 }: { coverUrl: string | null; title: string; size?: number }) {
  if (coverUrl) {
    return <img src={coverUrl} alt={title} style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0, display: "block" }} />;
  }
  const hue = Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: `hsl(${hue},50%,60%)`, display: "grid", placeItems: "center", flexShrink: 0, color: "white", fontSize: size * 0.36, fontWeight: 800 }}>
      {title[0]?.toUpperCase()}
    </div>
  );
}

// ─── CriticsFMGridCard ────────────────────────────────────────────────────────

function CriticsFMGridCard({ album }: { album: CriticsFMAlbum }) {
  return (
    <Link
      href={`/criticsfm/${album.id}`}
      style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        {album.coverUrl
          ? <img src={album.coverUrl} alt={album.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, background: `hsl(${Math.abs(album.title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360},50%,60%)`, display: "grid", placeItems: "center", color: "white", fontSize: 48, fontWeight: 800 }}>{album.title[0]?.toUpperCase()}</div>
        }
        <div style={{ position: "absolute", bottom: 10, left: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: album.reviewCount > 0 ? scoreColor(album.score) : "rgba(0,0,0,0.55)", color: "white", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            {album.reviewCount > 0 ? album.score : "—"}
          </div>
        </div>
        {album.reviewCount > 0 && (
          <div style={{ position: "absolute", bottom: 12, right: 10, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", color: "white", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
            {album.reviewCount} {album.reviewCount === 1 ? "review" : "reviews"}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{album.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{album.artist}</div>
        {album.releaseDate && (
          <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 6 }}>
            {album.releaseDate.slice(0, 4)}
            {album.albumType && <span> · {album.albumType === "ALBUM" ? "LP" : album.albumType}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── CriticsFMListRow — mobile compact list view ──────────────────────────────

function CriticsFMListRow({ album }: { album: CriticsFMAlbum }) {
  return (
    <Link
      href={`/criticsfm/${album.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--divider)", cursor: "pointer" }}>
        <AlbumCover coverUrl={album.coverUrl} title={album.title} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
            {album.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {album.reviewCount > 0
              ? `${album.artist} · ${album.reviewCount} reviews`
              : album.artist}
          </div>
        </div>
        {/* Score badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 9, flexShrink: 0,
          background: album.reviewCount > 0 ? scoreBg(album.score) : "var(--fill-inset)",
          color: album.reviewCount > 0 ? scoreColor(album.score) : "var(--text-disabled)",
          display: "grid", placeItems: "center",
          fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums",
          border: `1.5px solid ${album.reviewCount > 0 ? scoreColor(album.score) : "var(--text-disabled)"}30`,
        }}>
          {album.reviewCount > 0 ? album.score : "—"}
        </div>
      </div>
    </Link>
  );
}

// ─── View mode icons ──────────────────────────────────────────────────────────

function ListIcon({ active }: { active: boolean }) {
  const c = active ? "var(--text)" : "var(--text-muted)";
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
      <rect width="13" height="2" rx="1" fill={c} />
      <rect y="4.5" width="13" height="2" rx="1" fill={c} />
      <rect y="9" width="13" height="2" rx="1" fill={c} />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  const c = active ? "var(--text)" : "var(--text-muted)";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect width="5" height="5" rx="1" fill={c} />
      <rect x="7" width="5" height="5" rx="1" fill={c} />
      <rect y="7" width="5" height="5" rx="1" fill={c} />
      <rect x="7" y="7" width="5" height="5" rx="1" fill={c} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CriticsFMClient({ albums, showBreadcrumb = false }: { albums: CriticsFMAlbum[]; showBreadcrumb?: boolean }) {
  const isMobile = useIsMobile();
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [sortBy, setSortBy] = useState<SortId>("recent");
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [spotifyPanelQuery, setSpotifyPanelQuery] = useState<string | null>(null);
  const autoOpenedForRef = useRef<string | null>(null);

  // Reset showCount on filter/sort/search change
  useEffect(() => { setShowCount(PAGE_SIZE); }, [scoreFilter, sortBy, search]);

  const filtered = useMemo(() => {
    let list = albums.filter((a) => {
      if (!matchesScoreFilter(a, scoreFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.artist.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "score")   list = [...list].sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount);
    else if (sortBy === "reviews") list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    else list = [...list].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
    return list;
  }, [albums, scoreFilter, sortBy, search]);

  // Auto-open Spotify panel when local search returns nothing
  useEffect(() => {
    const term = search.trim();
    if (term && filtered.length === 0 && autoOpenedForRef.current !== term) {
      autoOpenedForRef.current = term;
      setSpotifyPanelQuery(term);
    } else if (!term || filtered.length > 0) {
      autoOpenedForRef.current = null;
    }
  }, [search, filtered.length]);

  const hasMore   = showCount < filtered.length;
  const paginated = filtered.slice(0, showCount);

  const topAlbums = useMemo(
    () => albums.filter((a) => a.reviewCount >= 2).sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount).slice(0, 6),
    [albums],
  );
  const showTop = scoreFilter === "all" && !search;

  return (
    <div>
      {spotifyPanelQuery !== null && (
        <SpotifySearchPanel onClose={() => setSpotifyPanelQuery(null)} initialQuery={spotifyPanelQuery} />
      )}

      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
          <Link href="/criticsfm" style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none", color: "var(--text-muted)", fontWeight: 500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            CriticsFM
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>Reviews</span>
        </div>
      )}

      {/* Page header */}
      {showBreadcrumb && (
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.05, color: "var(--text)" }}>
            CriticsFM
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 6, letterSpacing: "-0.01em" }}>
            Reúne as avaliações da comunidade ChartFM em um único lugar.
          </p>
        </header>
      )}

      {/* ── Top albums carousel ─────────────────────────────────────────── */}
      {showTop && topAlbums.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
            Melhores avaliados
          </div>
          {/* Horizontal scroll carousel */}
          <div
            style={{
              overflowX: "auto",
              display: "flex",
              gap: 10,
              paddingBottom: 4,
              /* bleed past container padding on mobile */
              margin: isMobile ? "0 -16px" : undefined,
              padding: isMobile ? "0 16px 4px" : "0 0 4px",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            {topAlbums.map((a) => (
              <Link
                key={a.id}
                href={`/criticsfm/${a.id}`}
                style={{ textDecoration: "none", color: "inherit", flexShrink: 0, width: isMobile ? 130 : 150 }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    borderRadius: 14,
                    border: "1px solid var(--divider)",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  {/* Cover */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1/1",
                      position: "relative",
                      background: a.coverUrl ? undefined : `hsl(${Math.abs(a.title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360},50%,60%)`,
                      display: "grid",
                      placeItems: "center",
                      color: "white",
                      fontSize: isMobile ? 38 : 44,
                      fontWeight: 800,
                    }}
                  >
                    {a.coverUrl
                      ? <img src={a.coverUrl} alt={a.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      : a.title[0]?.toUpperCase()
                    }
                    {/* Score pip */}
                    <div style={{
                      position: "absolute", bottom: 7, left: 7,
                      width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: isMobile ? 6 : 7,
                      background: scoreColor(a.score), color: "white",
                      display: "grid", placeItems: "center",
                      fontSize: isMobile ? 10 : 12, fontWeight: 800,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}>
                      {a.score}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "9px 10px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.artist}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--divider)" }}>

        {/* Search + Add row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Buscar álbum ou artista…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "9px 16px",
              borderRadius: 100,
              border: "1px solid var(--divider-strong)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              background: "var(--surface)",
              color: "var(--text)",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          />
          <button
            onClick={() => setSpotifyPanelQuery("")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 100, border: "none",
              background: "#1DB954", color: "white",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            {isMobile ? "Adicionar" : "Adicionar álbum"}
          </button>
        </div>

        {/* Score filter chips — single horizontal scroll line, never wraps */}
        <div
          style={{
            overflowX: "auto",
            display: "flex",
            gap: 6,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setScoreFilter(f.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 100,
                border: "none",
                flexShrink: 0,
                background: scoreFilter === f.id ? "var(--btn-dark-bg)" : "var(--fill-inset)",
                color: scoreFilter === f.id ? "var(--btn-dark-fg)" : "var(--text)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
                fontFamily: "inherit",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results header: count + view toggle + sort ───────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {/* Count */}
        <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, fontVariantNumeric: "tabular-nums" }}>
          {filtered.length} {filtered.length === 1 ? "álbum" : "álbuns"}
        </span>

        {/* View toggle — mobile only */}
        {isMobile && (
          <div style={{ display: "flex", gap: 2, background: "var(--fill-inset)", borderRadius: 8, padding: 2 }}>
            {(["list", "grid"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  width: 30,
                  height: 26,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: viewMode === mode ? "var(--surface)" : "transparent",
                  boxShadow: viewMode === mode ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {mode === "list" ? <ListIcon active={viewMode === "list"} /> : <GridIcon active={viewMode === "grid"} />}
              </button>
            ))}
          </div>
        )}

        {/* Sort */}
        <div style={{ display: "flex", gap: 3, background: "var(--fill-inset)", padding: 3, borderRadius: 10, flexShrink: 0 }}>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              style={{
                padding: isMobile ? "5px 9px" : "6px 12px",
                borderRadius: isMobile ? 7 : 8,
                border: "none",
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                background: sortBy === s.id ? "var(--surface)" : "transparent",
                color: sortBy === s.id ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
                boxShadow: sortBy === s.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              {isMobile ? s.short : s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Album grid / list ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum álbum encontrado</div>
          {search && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-disabled)", marginBottom: 12 }}>Quer adicionar este álbum ao catálogo?</div>
              <button
                onClick={() => setSpotifyPanelQuery(search)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 100, border: "none", background: "#1DB954", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Buscar no Spotify
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile list view */}
          {isMobile && viewMode === "list" ? (
            <div>
              {paginated.slice(0, 8).map((a) => <CriticsFMListRow key={a.id} album={a} />)}
              {paginated.length > 8 && <AdSlot slotId={ADSENSE_SLOTS.criticsFm} format="mobile-banner" style={{ margin: "10px 0" }} />}
              {paginated.slice(8).map((a) => <CriticsFMListRow key={a.id} album={a} />)}
            </div>
          ) : (
            /* Grid view: 3 cols mobile, 4 cols desktop */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
                gap: isMobile ? 8 : 14,
              }}
            >
              {paginated.slice(0, isMobile ? 6 : 8).map((a) => <CriticsFMGridCard key={a.id} album={a} />)}
              {paginated.length > (isMobile ? 6 : 8) && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <AdSlot slotId={ADSENSE_SLOTS.criticsFm} format="auto" style={{ margin: "4px 0" }} />
                </div>
              )}
              {paginated.slice(isMobile ? 6 : 8).map((a) => <CriticsFMGridCard key={a.id} album={a} />)}
            </div>
          )}

          {/* Load more — replaces pagination */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 28, marginBottom: 8 }}>
              <button
                onClick={() => setShowCount((c) => c + PAGE_SIZE)}
                style={{
                  padding: "11px 28px",
                  borderRadius: 100,
                  border: "1px solid var(--divider-strong)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                Carregar mais — {Math.min(PAGE_SIZE, filtered.length - showCount)} de {filtered.length - showCount} restantes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
