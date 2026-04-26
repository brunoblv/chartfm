"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, GripVertical, Plus, X } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { SONG_POOL, COVER_PALETTES } from "@/lib/data";
import type { Song, Cover as CoverModel } from "@/lib/types";

type ChartDetailResponse = {
  user: { id: string; handle: string; name: string };
  chart: {
    id: string;
    weekLabel: string;
    dateRange: string;
    entries: Array<{
      song: { title: string; artist: string; album: string; spotifyId?: string };
    }>;
  };
};

type SpotifyApiTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
};

function coverForSong(song: Song): CoverModel {
  const key = song.artist + song.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  return { palette, seed: Math.abs(hash) };
}

export default function EditChartPage() {
  const params = useParams();
  const router = useRouter();
  const raw = params?.id;
  const chartId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [entries, setEntries] = useState<Song[]>([]);
  const [search, setSearch] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [spotifyTracks, setSpotifyTracks] = useState<Song[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [searchBump, setSearchBump] = useState(0);
  const enterImmediateRef = useRef(false);

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
            title: e.song.title,
            artist: e.song.artist,
            album: e.song.album,
            spotifyId: e.song.spotifyId,
          })),
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [chartId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return SONG_POOL.slice(0, 8);
    const q = search.toLowerCase();
    return SONG_POOL.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)).slice(0, 12);
  }, [search]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 1) {
      setSpotifyTracks([]);
      setSpotifyLoading(false);
      return;
    }
    const immediate = enterImmediateRef.current;
    enterImmediateRef.current = false;
    const delay = immediate ? 0 : 400;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setSpotifyLoading(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=12`, { signal: ac.signal });
        const data = (await res.json()) as { tracks?: SpotifyApiTrack[]; configured?: boolean };
        if (data.configured === false) setSpotifyConfigured(false);
        else setSpotifyConfigured(true);
        const tracks: Song[] = (data.tracks ?? []).map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          imageUrl: t.imageUrl ?? undefined,
          spotifyId: t.spotifyId,
        }));
        if (!ac.signal.aborted) setSpotifyTracks(tracks);
      } catch {
        if (!ac.signal.aborted) setSpotifyTracks([]);
      } finally {
        if (!ac.signal.aborted) setSpotifyLoading(false);
      }
    }, delay);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [search, searchBump]);

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
        body: JSON.stringify({ entries }),
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

  return (
    <Shell title="Editar parada">
      <div style={{ maxWidth: 1100 }}>
        <Link href={`/chart/${chartId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
          <ChevronLeft size={16} />
          Voltar para a parada
        </Link>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", margin: 0 }}>Editar parada</h1>
        <p style={{ fontSize: 14, color: "#86868B", marginTop: 6 }}>{weekLabel}</p>

        {error && (
          <div style={{ marginTop: 12, marginBottom: 16, padding: "12px 16px", background: "rgba(250,36,60,0.08)", border: "1px solid rgba(250,36,60,0.2)", borderRadius: 10, color: "#B91C1C", fontSize: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 24, color: "#86868B" }}>Carregando parada...</div>
        ) : (
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
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
              {entries.map((song, i) => (
                <div
                  key={`${song.title}-${song.artist}-${i}`}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDrop={() => handleDrop(i)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "38px 44px 56px 1fr 36px",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                    background: dragOver === i ? "rgba(250,36,60,0.04)" : "white",
                  }}
                >
                  <div style={{ color: "#C7C7CC", display: "flex", justifyContent: "center" }}><GripVertical size={16} /></div>
                  <div style={{ fontSize: 19, fontWeight: 700, textAlign: "right" }}>{i + 1}</div>
                  <div style={{ padding: "0 8px" }}>
                    <Cover cover={coverForSong(song)} song={song} size={42} rounded={8} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                    <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
                  </div>
                  <button onClick={() => removeSong(i)} style={{ background: "none", border: "none", color: "#C7C7CC", cursor: "pointer", display: "flex", justifyContent: "center" }}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ position: "sticky", top: 100 }}>
              <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Adicionar músicas</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const q = search.trim();
                    if (q.length < 1) return;
                    enterImmediateRef.current = true;
                    setSearchBump((b) => b + 1);
                  }}
                  placeholder="Título ou artista..."
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "10px 12px", fontSize: 14, marginBottom: 12 }}
                />
                {search.trim().length >= 1 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                      Spotify
                    </div>
                    {spotifyLoading && <div style={{ fontSize: 13, color: "#86868B" }}>Buscando...</div>}
                    {!spotifyLoading && !spotifyConfigured && (
                      <div style={{ fontSize: 12, color: "#86868B", lineHeight: 1.5 }}>
                        Configure <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_ID</code> e <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_SECRET</code> no arquivo <code style={{ fontSize: 11 }}>.env</code>.
                      </div>
                    )}
                    {!spotifyLoading && spotifyConfigured && spotifyTracks.length === 0 && (
                      <div style={{ fontSize: 12, color: "#86868B" }}>Nenhum resultado no Spotify.</div>
                    )}
                    {!spotifyLoading &&
                      spotifyTracks.map((song) => {
                        const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                        return (
                          <div key={`${song.title}-${song.artist}-${song.spotifyId ?? "spotify"}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
                            <Cover cover={coverForSong(song)} song={song} size={36} rounded={6} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                              <div style={{ fontSize: 11, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
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
                                display: "grid",
                                placeItems: "center",
                                cursor: added ? "default" : "pointer",
                              }}
                            >
                              {added ? "✓" : <Plus size={14} />}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                  Catálogo local
                </div>
                {filtered.map((song) => {
                  const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                  return (
                    <div key={`${song.title}-${song.artist}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
                      <Cover cover={coverForSong(song)} song={song} size={36} rounded={6} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                        <div style={{ fontSize: 11, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
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
                          display: "grid",
                          placeItems: "center",
                          cursor: added ? "default" : "pointer",
                        }}
                      >
                        {added ? "✓" : <Plus size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
