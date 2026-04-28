"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { buildSongPath, buildArtistPath } from "@/lib/music-routes";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { COVER_PALETTES } from "@/lib/data";

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
  color: "#86868B",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: "rgba(0,0,0,0.06)",
  margin: "4px 0",
};

interface SearchBarProps {
  onClose?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ onClose, autoFocus }: SearchBarProps) {
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
          background: "rgba(120,120,128,0.1)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <Search size={14} color={loading ? "#FA243C" : "#86868B"} />
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
          placeholder="Buscar músicas, artistas, usuários"
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 14,
            color: "#1D1D1F",
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
              color: "#86868B",
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
            background: "white",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {!hasResults ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                color: "#86868B",
                fontSize: 14,
              }}
            >
              Nenhum resultado para &ldquo;{query.trim()}&rdquo;
            </div>
          ) : (
            <>
              {results.artists.length > 0 && (
                <div>
                  <div style={SECTION_LABEL}>Artistas</div>
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
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
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
                            background: "#E5E5EA",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#86868B",
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
                          color: "#1D1D1F",
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
                  <div style={SECTION_LABEL}>Músicas</div>
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
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
                              color: "#1D1D1F",
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
                              color: "#86868B",
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
                  <div style={SECTION_LABEL}>Usuários</div>
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
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
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
                            color: "#1D1D1F",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#86868B" }}>@{user.handle}</div>
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
