"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, GripVertical, Plus, X, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { SONG_POOL, COVER_PALETTES } from "@/lib/data";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Song, Cover as CoverModel, Chart } from "@/lib/types";
import { ADMIN_LASTFM_COVER_FALLBACK_KEY } from "@/lib/admin-flags";

type ChartDetailResponse = {
  user: { id: string; handle: string; name: string };
  chart: Pick<Chart, "id" | "weekLabel" | "dateRange" | "entries">;
};

type SpotifyApiTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
};

type DbSong = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  coverUrl: string | null;
};

const COVER_PALETTES_EDIT = COVER_PALETTES;

function coverForSong(song: Song): CoverModel {
  const key = song.artist + song.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES_EDIT[Math.abs(hash) % COVER_PALETTES_EDIT.length];
  const base: CoverModel = { palette, seed: Math.abs(hash) };
  return song.imageUrl ? { ...base, imageUrl: song.imageUrl } : base;
}

const SPOTIFY_SEARCH_DISABLED = false;

export default function EditChartPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const isAdmin = session?.user?.handle === "bruno";
  const raw = params?.id;
  const chartId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [entries, setEntries] = useState<Song[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dbQuery, setDbQuery] = useState("");
  const [lastfmQuery, setLastfmQuery] = useState("");
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [spotifyTracks, setSpotifyTracks] = useState<Song[]>([]);
  const [lastfmTracks, setLastfmTracks] = useState<Song[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [lastfmLoading, setLastfmLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [lastfmConfigured, setLastfmConfigured] = useState(true);
  const [adminCoverFallback, setAdminCoverFallback] = useState(false);

  useEffect(() => {
    if (!chartId) return;
    setLoading(true);
    fetch(`/api/charts/${encodeURIComponent(chartId)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("Você não pode editar esta parada.");
          throw new Error("Não foi possível carregar a parada.");
        }
        const data = (await res.json()) as ChartDetailResponse;
        setWeekLabel(data.chart.weekLabel);
        setEntries(
          data.chart.entries.map((e) => ({
            id: e.song.id,
            title: e.song.title,
            artist: e.song.artist,
            album: e.song.album ?? "",
            spotifyId: e.song.spotifyId ?? undefined,
            imageUrl: e.song.imageUrl ?? e.cover?.imageUrl ?? undefined,
            slugArtist: e.song.slugArtist,
            lastfmUrl: e.song.lastfmUrl ?? undefined,
          })),
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [chartId]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminCoverFallback(false);
      return;
    }
    const sync = () => {
      try {
        setAdminCoverFallback(localStorage.getItem(ADMIN_LASTFM_COVER_FALLBACK_KEY) === "1");
      } catch {
        setAdminCoverFallback(false);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("chartify-admin-flags-updated", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("chartify-admin-flags-updated", sync as EventListener);
    };
  }, [isAdmin]);

  const filtered = dbQuery
    ? SONG_POOL.filter(
        (s) =>
          s.title.toLowerCase().includes(dbQuery.toLowerCase()) ||
          s.artist.toLowerCase().includes(dbQuery.toLowerCase()),
      ).slice(0, 8)
    : SONG_POOL.slice(0, 6);

  useEffect(() => {
    const q = dbQuery.trim();
    if (q.length < 2) {
      setDbSongs([]);
      setDbLoading(false);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setDbLoading(true);
      try {
        const dbRes = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (ac.signal.aborted) return;
        if (!dbRes.ok) {
          setDbSongs([]);
        } else {
          const dbData = (await dbRes.json()) as { songs?: DbSong[] };
          if (ac.signal.aborted) return;
          setDbSongs(
            (dbData.songs ?? []).map((s) => ({
              id: s.id,
              title: s.title,
              artist: s.artist,
              album: s.album ?? "",
              spotifyId: s.spotifyId ?? undefined,
              imageUrl: s.coverUrl ?? undefined,
            })),
          );
        }
      } catch {
        if (!ac.signal.aborted) setDbSongs([]);
      } finally {
        if (!ac.signal.aborted) setDbLoading(false);
      }
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [dbQuery]);

  useEffect(() => {
    const q = lastfmQuery.trim();
    if (q.length < 1) {
      setLastfmTracks([]);
      setLastfmLoading(false);
      setLastfmConfigured(true);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLastfmLoading(true);
      try {
        const coverFallbackParam = adminCoverFallback ? "&coverFallback=1" : "";
        const lfRes = await fetch(`/api/lastfm/search?q=${encodeURIComponent(q)}&limit=12${coverFallbackParam}`, {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (!lfRes.ok) {
          setLastfmConfigured(true);
          setLastfmTracks([]);
        } else {
          const lfData = (await lfRes.json()) as {
            tracks?: Array<{
              title: string;
              artist: string;
              album: string | null;
              imageUrl: string | null;
              url: string | null;
            }>;
            configured?: boolean;
          };
          if (ac.signal.aborted) return;
          setLastfmConfigured(lfData.configured !== false);
          if (lfData.configured === false) {
            setLastfmTracks([]);
          } else {
            setLastfmTracks(
              (lfData.tracks ?? []).map((t) => ({
                title: t.title,
                artist: t.artist,
                album: t.album ?? "",
                imageUrl: t.imageUrl ?? undefined,
                lastfmUrl: t.url ?? undefined,
              })),
            );
          }
        }
      } catch {
        if (!ac.signal.aborted) {
          setLastfmTracks([]);
          setLastfmConfigured(true);
        }
      } finally {
        if (!ac.signal.aborted) setLastfmLoading(false);
      }
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [lastfmQuery, adminCoverFallback]);

  useEffect(() => {
    if (SPOTIFY_SEARCH_DISABLED) {
      setSpotifyTracks([]);
      setSpotifyLoading(false);
      setSpotifyConfigured(false);
      return;
    }
    const q = spotifyQuery.trim();
    if (q.length < 1) {
      setSpotifyTracks([]);
      setSpotifyLoading(false);
      setSpotifyConfigured(true);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setSpotifyLoading(true);
      try {
        const spotifyRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=12`, {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (!spotifyRes.ok) {
          setSpotifyConfigured(false);
          setSpotifyTracks([]);
        } else {
          try {
            const spotifyData = (await spotifyRes.json()) as {
              tracks?: SpotifyApiTrack[];
              configured?: boolean;
            };
            if (ac.signal.aborted) return;
            setSpotifyConfigured(spotifyData.configured !== false);
            setSpotifyTracks(
              (spotifyData.tracks ?? []).map((t) => ({
                title: t.title,
                artist: t.artist,
                album: t.album,
                imageUrl: t.imageUrl ?? undefined,
                spotifyId: t.spotifyId,
              })),
            );
          } catch {
            if (ac.signal.aborted) return;
            setSpotifyConfigured(false);
            setSpotifyTracks([]);
          }
        }
      } catch {
        if (ac.signal.aborted) return;
        setSpotifyConfigured(false);
        setSpotifyTracks([]);
      } finally {
        if (!ac.signal.aborted) setSpotifyLoading(false);
      }
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [spotifyQuery]);

  const addSong = (song: Song) => {
    if (entries.some((e) => e.title === song.title && e.artist === song.artist)) return;
    setEntries((prev) => [...prev, song]);
  };

  const removeSong = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (i: number) => {
    if (dragIndex === null) return;
    const arr = [...entries];
    const [item] = arr.splice(dragIndex, 1);
    arr.splice(i, 0, item);
    setEntries(arr);
    setDragIndex(null);
    setDragOver(null);
  };

  const saveChart = async () => {
    if (!chartId) return;
    if (entries.length === 0) {
      setError("Adicione ao menos uma música.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/charts/${chartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map((e) => ({
            title: e.title,
            artist: e.artist,
            album: e.album,
            spotifyId: e.spotifyId ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar alterações.");
        return;
      }
      router.push(`/chart/${chartId}`);
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const renderSongRow = (song: Song, added: boolean) => {
    const cover = coverForSong(song);
    return (
      <div
        key={`${song.title}-${song.artist}-${song.spotifyId ?? song.lastfmUrl ?? "local"}`}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderRadius: 8 }}
      >
        <Cover cover={cover} song={song} size={40} rounded={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
          <div style={{ fontSize: 11, color: "#86868B", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{song.artist}</span>
            {song.spotifyId ? (
              <a
                href={`https://open.spotify.com/track/${song.spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                style={{ color: "#1DB954", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600 }}
                title="Abrir no Spotify"
              >
                <ExternalLink size={10} />
                Spotify
              </a>
            ) : song.lastfmUrl ? (
              <a
                href={song.lastfmUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                style={{ color: "#D51007", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600 }}
                title="Abrir no Last.fm"
              >
                <ExternalLink size={10} />
                Last.fm
              </a>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => addSong(song)}
          disabled={added}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: added ? "#E8F8EE" : "#FA243C",
            color: added ? "#1B873F" : "white",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: added ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {added ? "✓" : <Plus size={14} />}
        </button>
      </div>
    );
  };

  const searchPanel = (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Buscar música</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
          1) Catálogo
        </div>
        <input
          value={dbQuery}
          onChange={(e) => setDbQuery(e.target.value)}
          placeholder="Pesquisar no catálogo local"
          style={{
            width: "100%",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            color: "#1D1D1F",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />
        {dbQuery.trim().length >= 2 ? (
          <>
            {dbLoading && <div style={{ fontSize: 13, color: "#86868B" }}>Buscando…</div>}
            {!dbLoading &&
              (dbSongs.length > 0 ? (
                dbSongs.map((song) => {
                  const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                  return renderSongRow(song, added);
                })
              ) : (
                <div style={{ fontSize: 12, color: "#86868B" }}>Nenhuma música no catálogo.</div>
              ))}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#86868B", marginBottom: 10, lineHeight: 1.45 }}>
              Digite ao menos 2 caracteres para buscar no catálogo completo. Sugestões locais:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.map((song) => {
                const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                return renderSongRow(song, added);
              })}
            </div>
          </>
        )}
      </div>

      {false && (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            2) Last.fm
          </div>
          {isAdmin && (
            <div style={{ fontSize: 11, color: adminCoverFallback ? "#0F9D58" : "#86868B", fontWeight: 700 }}>
              Capa CAA: {adminCoverFallback ? "ON" : "OFF"}
            </div>
          )}
        </div>
        <input
          value={lastfmQuery}
          onChange={(e) => setLastfmQuery(e.target.value)}
          placeholder="Pesquisar no Last.fm"
          style={{
            width: "100%",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            color: "#1D1D1F",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />
        {lastfmQuery.trim().length < 1 ? (
          <div style={{ fontSize: 12, color: "#86868B" }}>Digite para pesquisar no Last.fm.</div>
        ) : (
          <>
            {lastfmLoading && <div style={{ fontSize: 13, color: "#86868B" }}>Buscando…</div>}
            {!lastfmLoading && !lastfmConfigured && (
              <div style={{ fontSize: 12, color: "#86868B", lineHeight: 1.5 }}>
                Configure <code style={{ fontSize: 11 }}>API_KEY</code> (Last.fm) no arquivo <code style={{ fontSize: 11 }}>.env</code>.
              </div>
            )}
            {!lastfmLoading && lastfmConfigured && lastfmTracks.length === 0 && (
              <div style={{ fontSize: 12, color: "#86868B" }}>Nenhum resultado no Last.fm.</div>
            )}
            {!lastfmLoading &&
              lastfmConfigured &&
              lastfmTracks.map((song) => {
                const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                return renderSongRow(song, added);
              })}
          </>
        )}
      </div>
      )}

      <div style={{ marginBottom: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
          3) Spotify
        </div>
        <input
          value={spotifyQuery}
          onChange={(e) => setSpotifyQuery(e.target.value)}
          placeholder={SPOTIFY_SEARCH_DISABLED ? "Spotify desativado temporariamente" : "Pesquisar no Spotify"}
          disabled={SPOTIFY_SEARCH_DISABLED}
          style={{
            width: "100%",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            color: SPOTIFY_SEARCH_DISABLED ? "#86868B" : "#1D1D1F",
            background: SPOTIFY_SEARCH_DISABLED ? "#F5F5F7" : "white",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />
        {SPOTIFY_SEARCH_DISABLED ? (
          <div style={{ fontSize: 12, color: "#86868B" }}>Busca no Spotify está desativada no momento.</div>
        ) : spotifyQuery.trim().length < 1 ? (
          <div style={{ fontSize: 12, color: "#86868B" }}>Digite para pesquisar no Spotify.</div>
        ) : (
          <>
            {spotifyLoading && <div style={{ fontSize: 13, color: "#86868B" }}>Buscando…</div>}
            {!spotifyLoading && !spotifyConfigured && (
              <div style={{ fontSize: 12, color: "#86868B", lineHeight: 1.5 }}>
                Configure <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_ID</code> e <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_SECRET</code> no arquivo{" "}
                <code style={{ fontSize: 11 }}>.env</code>.
              </div>
            )}
            {!spotifyLoading && spotifyConfigured && spotifyTracks.length === 0 && (
              <div style={{ fontSize: 12, color: "#86868B" }}>Nenhum resultado no Spotify.</div>
            )}
            {!spotifyLoading &&
              spotifyTracks.map((song) => {
                const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                return renderSongRow(song, added);
              })}
          </>
        )}
      </div>
    </div>
  );

  const chartList = (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Top {entries.length}</div>
        <button
          onClick={saveChart}
          disabled={saving || entries.length === 0}
          style={{
            background: entries.length === 0 ? "#E5E7EB" : "#FA243C",
            color: entries.length === 0 ? "#9CA3AF" : "white",
            border: "none",
            padding: "9px 18px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            cursor: saving || entries.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Salvando..." : "Salvar edição"}
        </button>
      </div>
      {entries.map((song, i) => {
        const cover = coverForSong(song);
        return (
          <div
            key={`${song.id ?? ""}-${song.title}-${song.artist}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(i);
            }}
            onDrop={() => handleDrop(i)}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "32px 36px 52px 1fr 32px" : "38px 44px 56px 1fr 36px",
              alignItems: "center",
              padding: isMobile ? "10px 12px" : "10px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              background: dragOver === i ? "rgba(250,36,60,0.04)" : "white",
              cursor: "grab",
            }}
          >
            <div style={{ color: "#C7C7CC", display: "flex", justifyContent: "center" }}>
              <GripVertical size={16} />
            </div>
            <div style={{ fontSize: isMobile ? 16 : 19, fontWeight: 700, textAlign: "right" }}>{i + 1}</div>
            <div style={{ padding: "0 8px" }}>
              <Cover cover={cover} song={song} size={isMobile ? 36 : 42} rounded={8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
              <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
            </div>
            <button
              onClick={() => removeSong(i)}
              style={{ background: "none", border: "none", color: "#C7C7CC", cursor: "pointer", display: "flex", justifyContent: "center" }}
            >
              <X size={18} />
            </button>
          </div>
        );
      })}
      {entries.length === 0 && !loading && (
        <div style={{ padding: "40px 24px", textAlign: "center", color: "#86868B", fontSize: 14 }}>
          {isMobile ? "Use a busca abaixo e adicione à parada" : "Adicione músicas na busca ao lado →"}
        </div>
      )}
    </div>
  );

  return (
    <Shell title="">
      <div style={{ maxWidth: 1100 }}>
        <Link
          href={`/chart/${chartId}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 12 }}
        >
          <ChevronLeft size={16} />
          Voltar para a parada
        </Link>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", margin: 0 }}>Editar parada</h1>
        <p style={{ fontSize: 14, color: "#86868B", marginTop: 6 }}>{weekLabel}</p>

        {error && (
          <div
            style={{
              marginTop: 12,
              marginBottom: 16,
              padding: "12px 16px",
              background: "rgba(250,36,60,0.08)",
              border: "1px solid rgba(250,36,60,0.2)",
              borderRadius: 10,
              color: "#B91C1C",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 24, color: "#86868B" }}>Carregando parada...</div>
        ) : isMobile ? (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {searchPanel}
            {chartList}
          </div>
        ) : (
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
            {chartList}
            <div style={{ position: "sticky", top: 100 }}>{searchPanel}</div>
          </div>
        )}
      </div>
    </Shell>
  );
}
