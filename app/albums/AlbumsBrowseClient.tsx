"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlbumRow } from "./page";
import { scoreColor, scoreBg, scoreLabel } from "@/lib/album-score";
import { buildAlbumPath } from "@/lib/music-routes";
import { useTranslations } from "@/hooks/useTranslations";

type BuildAlbumPath = (
  album: string,
  artist: string,
  ids?: { artistId?: number | string | null; albumId?: number | string | null },
) => string;

type SortId = "recent" | "score" | "reviews";

const PAGE_SIZE = 12;

function getGenres(a: AlbumRow): string[] {
  return a.genres
    .flatMap((g) => g.split(/[,/]/).map((s) => s.trim()))
    .filter(Boolean);
}

function albumHref(a: AlbumRow, bp: BuildAlbumPath): string {
  return bp(a.title, a.artist, { artistId: a.artistId, albumId: a.id });
}

export function AlbumsBrowseClient({ albums }: { albums: AlbumRow[] }) {
  const { t } = useTranslations();
  const allLabel = t("albums.all");
  const SORT_OPTIONS: { id: SortId; label: string }[] = [
    { id: "recent", label: t("albums.recent") },
    { id: "score", label: t("albums.score") },
    { id: "reviews", label: t("albums.reviews") },
  ];
  const [activeGenre, setActiveGenre] = useState(allLabel);
  const [sortBy, setSortBy] = useState<SortId>("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [activeGenre, sortBy, search]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const a of albums) {
      for (const g of getGenres(a)) set.add(g);
    }
    return [allLabel, ...Array.from(set).sort()];
  }, [albums, allLabel]);

  const filtered = useMemo(() => {
    let list = albums.filter((a) => {
      if (activeGenre !== allLabel && !getGenres(a).includes(activeGenre)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.artist.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "score") list = [...list].sort((a, b) => b.score - a.score);
    else if (sortBy === "recent")
      list = [...list].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
    else if (sortBy === "reviews") list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);

    return list;
  }, [albums, activeGenre, sortBy, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const featured = filtered[0];
  const bestRated = filtered.filter((a) => a.score >= 70).sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Search + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder={t("albums.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "0 0 220px",
            padding: "9px 14px",
            borderRadius: 100,
            border: "1px solid var(--divider-strong)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        <div style={{ display: "flex", gap: 6, flex: 1, overflowX: "auto" }}>
          {allGenres.slice(0, 14).map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              style={{
                padding: "7px 16px",
                borderRadius: 100,
                border: "none",
                background: activeGenre === g ? "var(--btn-dark-bg)" : "var(--fill-subtle)",
                color: activeGenre === g ? "var(--btn-dark-fg)" : "var(--text)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              {g}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "var(--fill-subtle)",
            padding: 3,
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {SORT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                background: sortBy === id ? "var(--surface)" : "transparent",
                color: sortBy === id ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
                boxShadow: sortBy === id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {featured && <FeaturedAlbumCard album={featured} buildAlbumPath={buildAlbumPath} />}

      {/* Best rated */}
      {bestRated.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 6 }}>
            {t("albums.topRated")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            {t("albums.scoreMin")}
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
            {bestRated.map((a) => (
              <AlbumCompactCard key={a.id} album={a} buildAlbumPath={buildAlbumPath} />
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ marginTop: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em" }}>
            {t("albums.allAlbums")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("albums.albumCount", { count: filtered.length })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 15 }}>
            {t("albums.notFound")}
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
                <AlbumGridCard key={a.id} album={a} buildAlbumPath={buildAlbumPath} />
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
                    border: "1px solid var(--divider-strong)",
                    background: page === 0 ? "var(--fill-subtle)" : "var(--surface)",
                    color: page === 0 ? "var(--text-muted)" : "var(--text)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === 0 ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("albums.prev")}
                </button>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 100,
                    border: "1px solid var(--divider-strong)",
                    background: page === totalPages - 1 ? "var(--fill-subtle)" : "var(--surface)",
                    color: page === totalPages - 1 ? "var(--text-muted)" : "var(--text)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === totalPages - 1 ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("albums.next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CoverSquare({ album, size }: { album: AlbumRow; size: number | "full" }) {
  const seed = album.id;
  const hue = (seed * 47) % 360;
  const hue2 = (hue + 40) % 360;

  const dim = size === "full" ? "100%" : size;

  return (
    <div
      style={{
        width: dim,
        height: dim,
        aspectRatio: size === "full" ? "1/1" : undefined,
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
        background: `linear-gradient(${seed % 360}deg, hsl(${hue},65%,45%), hsl(${hue2},70%,35%))`,
        position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {album.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={album.coverUrl}
          alt={album.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}

function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? 48 : 40;
  const fs = size === "md" ? 18 : 15;
  const br = size === "md" ? 12 : 10;

  if (score === 0) {
    return (
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: br,
          background: "var(--fill-subtle)",
          color: "var(--text-muted)",
          display: "grid",
          placeItems: "center",
          fontSize: fs,
          fontWeight: 800,
        }}
      >
        -
      </div>
    );
  }
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: br,
        background: scoreBg(score),
        color: scoreColor(score),
        display: "grid",
        placeItems: "center",
        fontSize: fs,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        border: `2px solid ${scoreColor(score)}30`,
      }}
    >
      {score}
    </div>
  );
}

function FeaturedAlbumCard({ album, buildAlbumPath }: { album: AlbumRow; buildAlbumPath: BuildAlbumPath }) {
  const { t, locale } = useTranslations();
  const genres = getGenres(album);

  return (
    <a
      href={albumHref(album, buildAlbumPath)}
      style={{
        display: "flex",
        gap: 28,
        alignItems: "center",
        padding: 28,
        borderRadius: 20,
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        cursor: "pointer",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <CoverSquare album={album} size={180} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            background: "var(--accent-tint)",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            marginBottom: 12,
            letterSpacing: "0.02em",
          }}
        >
          {t("albums.featuredBadge")}
        </div>
        <div
          style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 4 }}
        >
          {album.title}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          {album.artist}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
          {genres.slice(0, 2).join(" · ")}
          {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""}
          {album.totalTracks ? ` · ${t("albums.tracksCount", { count: album.totalTracks })}` : ""}
          {album.reviewCount > 0 ? ` · ${t("albums.reviewsCount", { count: album.reviewCount })}` : ""}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <ScoreBadge score={album.score} size="md" />
          {album.score > 0 ? (
            <div>
              <div
                style={{ fontSize: 15, fontWeight: 700, color: scoreColor(album.score), letterSpacing: "-0.01em" }}
              >
                {scoreLabel(album.score, locale)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {t("albums.ratingsCount", { count: album.ratingCount })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("albums.beFirstToRate")}</div>
          )}
        </div>
      </div>
    </a>
  );
}

function AlbumGridCard({ album, buildAlbumPath }: { album: AlbumRow; buildAlbumPath: BuildAlbumPath }) {
  const { t } = useTranslations();
  const genres = getGenres(album);

  return (
    <a
      href={albumHref(album, buildAlbumPath)}
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        <CoverSquare album={album} size="full" />
        <div style={{ position: "absolute", bottom: 12, left: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: album.score > 0 ? scoreColor(album.score) : "rgba(0,0,0,0.55)",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {album.score > 0 ? album.score : "-"}
          </div>
        </div>
        {album.reviewCount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 12,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              color: "white",
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {t("albums.reviewsCount", { count: album.reviewCount })}
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            fontSize: 15,
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
            fontSize: 13,
            color: "var(--text-muted)",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {album.artist}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            {genres[0] ?? t("albums.genreFallback")}
          </span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            {album.releaseDate?.slice(0, 4) ?? "-"}
          </span>
        </div>
      </div>
    </a>
  );
}

function AlbumCompactCard({ album, buildAlbumPath }: { album: AlbumRow; buildAlbumPath: BuildAlbumPath }) {
  const { t } = useTranslations();
  return (
    <a
      href={albumHref(album, buildAlbumPath)}
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        border: "1px solid var(--divider)",
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
        cursor: "pointer",
        minWidth: 260,
        flexShrink: 0,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <CoverSquare album={album} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
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
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{album.artist}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {album.reviewCount > 0
            ? t("albums.reviewsCount", { count: album.reviewCount })
            : t("albums.noReviewsYet")}
        </div>
      </div>
      <ScoreBadge score={album.score} size="md" />
    </a>
  );
}
