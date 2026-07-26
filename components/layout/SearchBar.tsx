"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { buildSongPath, buildArtistPath } from "@/lib/music-routes";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { COVER_PALETTES } from "@/lib/data";
import { useTranslations } from "@/hooks/useTranslations";

type SearchSong = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  coverUrl: string | null;
};

type SearchArtist = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
};

type SearchUser = {
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
};

type SearchResults = {
  songs: SearchSong[];
  artists: SearchArtist[];
  users: SearchUser[];
};

function songCover(title: string, artist: string): { palette: [string, string]; seed: number } {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const abs = Math.abs(hash);
  return { palette: COVER_PALETTES[abs % COVER_PALETTES.length], seed: abs };
}

const SECTION_LABEL: React.CSSProperties = {
  padding: "10px 16px 4px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: "var(--divider)",
  margin: "4px 0",
};

interface SearchBarProps {
  onClose?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ onClose, autoFocus }: SearchBarProps) {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as SearchResults;
        setResults(data);
        setOpen(true);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query]);

  function clear() {
    setQuery("");
    setResults(null);
    setOpen(false);
    onClose?.();
  }

  function handleLinkClick() {
    setOpen(false);
    setQuery("");
    setResults(null);
    onClose?.();
  }

  const hasResults =
    results && (results.songs.length > 0 || results.artists.length > 0 || results.users.length > 0);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--fill-subtle)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <Search size={14} color={loading ? "var(--accent)" : "var(--text-muted)"} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results && hasResults) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") clear();
          }}
          placeholder={t("search.placeholder")}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 14,
            color: "var(--text)",
            width: "100%",
          }}
        />
        {query && (
          <button
            onClick={clear}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface-elevated)",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid var(--divider)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {!hasResults ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              {t("search.noResults", { query: query.trim() })}
            </div>
          ) : (
            <>
              {results.artists.length > 0 && (
                <div>
                  <div style={SECTION_LABEL}>{t("search.artists")}</div>
                  {results.artists.map((artist) => (
                    <Link
                      key={artist.spotifyId}
                      href={buildArtistPath(artist.name, artist.spotifyId)}
                      onClick={handleLinkClick}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 16px",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fill-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt={artist.name}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "var(--fill-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          {artist.name[0]}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {artist.name}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.songs.length > 0 && (
                <div>
                  {results.artists.length > 0 && <div style={DIVIDER} />}
                  <div style={SECTION_LABEL}>{t("search.songs")}</div>
                  {results.songs.map((song) => {
                    const cover = songCover(song.title, song.artist);
                    return (
                      <Link
                        key={song.id}
                        href={buildSongPath({
                          title: song.title,
                          artist: song.artist,
                          spotifyId: song.spotifyId,
                        })}
                        onClick={handleLinkClick}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 16px",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fill-subtle)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Cover
                          cover={cover}
                          song={
                            song.coverUrl
                              ? { title: song.title, artist: song.artist, imageUrl: song.coverUrl }
                              : undefined
                          }
                          size={36}
                          rounded={6}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {song.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {song.artist}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {results.users.length > 0 && (
                <div>
                  {(results.artists.length > 0 || results.songs.length > 0) && (
                    <div style={DIVIDER} />
                  )}
                  <div style={SECTION_LABEL}>{t("search.users")}</div>
                  {results.users.map((user) => (
                    <Link
                      key={user.handle}
                      href={`/profile/${user.handle}`}
                      onClick={handleLinkClick}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 16px 10px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fill-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Avatar
                        user={{ name: user.name, avatar: user.avatarColor }}
                        imageUrl={user.image}
                        size={36}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{user.handle}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
