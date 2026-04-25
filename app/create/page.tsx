"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, X, GripVertical, ExternalLink } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { SONG_POOL, COVER_PALETTES } from "@/lib/data";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Cover as CoverModel, Song } from "@/lib/types";

const COVER_PALETTES_IMPORT = COVER_PALETTES;

/** Mesma lógica de semana ISO usada em `POST /api/charts`. */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Ano civil da quinta-feira da semana ISO (evita “Semana 1” no fim de dezembro com ano errado). */
function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

function weekRange(date: Date): { start: Date; end: Date } {
  const end = new Date(date);
  const day = end.getDay();
  end.setDate(end.getDate() + (day === 0 ? 0 : 7 - day));
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start, end };
}

function formatPtDayMonth(date: Date): string {
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${date.getDate()} de ${monthCap}`;
}

function toInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function coverForSong(song: Song): CoverModel {
  const key = song.artist + song.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES_IMPORT[Math.abs(hash) % COVER_PALETTES_IMPORT.length];
  const base: CoverModel = { palette, seed: Math.abs(hash) };
  return song.imageUrl ? { ...base, imageUrl: song.imageUrl } : base;
}

type SpotifyApiTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
};

type LatestChartResponse = {
  id: string;
  weekLabel: string;
  dateRange: string;
  entries: Array<{
    title: string;
    artist: string;
    album: string;
    spotifyId: string | null;
  }>;
  error?: string;
};

export default function CreatePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [entries, setEntries] = useState<Song[]>([]);
  const [weekDate, setWeekDate] = useState(toInputDate(new Date()));
  const [search, setSearch] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [spotifyTracks, setSpotifyTracks] = useState<Song[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [importingLast, setImportingLast] = useState(false);
  const [paradaNome, setParadaNome] = useState<string | null>(null);
  const [searchBump, setSearchBump] = useState(0);
  const enterImmediateRef = useRef(false);

  useEffect(() => {
    fetch("/api/user/parada")
      .then((r) => r.json())
      .then((data: { paradaNome?: string | null }) => {
        const nome = typeof data.paradaNome === "string" && data.paradaNome.trim() ? data.paradaNome.trim() : null;
        setParadaNome(nome);
        if (!nome) router.replace("/parada/setup");
      })
      .catch(() => {});
  }, [router]);

  const filtered = search
    ? SONG_POOL.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.artist.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : SONG_POOL.slice(0, 6);

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
    setEntries([...entries, song]);
  };

  const removeSong = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOver(i);
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

  const publishChart = async () => {
    if (entries.length === 0) {
      setPublishError("Adicione ao menos uma música antes de publicar.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, weekDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error ?? "Erro ao publicar parada.");
        return;
      }
      router.push(`/chart/${data.id}`);
    } catch {
      setPublishError("Erro de conexão. Tente novamente.");
    } finally {
      setPublishing(false);
    }
  };

  const importLastChart = async () => {
    setImportingLast(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/charts/latest");
      const data = (await res.json()) as LatestChartResponse;
      if (!res.ok) {
        if (res.status === 404) {
          setPublishError("Você ainda não tem uma parada anterior para importar.");
          return;
        }
        setPublishError(data.error ?? "Não foi possível importar a última parada.");
        return;
      }
      setEntries(
        data.entries.map((e) => ({
          title: e.title,
          artist: e.artist,
          album: e.album,
          spotifyId: e.spotifyId ?? undefined,
        }))
      );
    } catch {
      setPublishError("Erro de conexão ao importar a última parada.");
    } finally {
      setImportingLast(false);
    }
  };

  const renderSongRow = (song: Song, added: boolean) => {
    const cover = coverForSong(song);
    return (
      <div key={`${song.title}-${song.artist}-${song.spotifyId ?? "local"}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderRadius: 8 }}>
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
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#1DB954", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600 }}
                title="Abrir no Spotify"
              >
                <ExternalLink size={10} />
                Spotify
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

  const tituloParada = paradaNome ?? "Monte sua parada";
  const nomeParadaCard = paradaNome ?? "Sua parada";
  const weekDateObj = fromInputDate(weekDate) ?? new Date();
  const semanaAtual = isoWeekNumber(weekDateObj);
  const anoSemanaIso = isoWeekYear(weekDateObj);
  const tituloParadaSemanaAno = `${nomeParadaCard} - Semana ${semanaAtual} - ${anoSemanaIso}`;
  const { start: inicioSemana, end: fimSemana } = weekRange(weekDateObj);
  const subtituloSemana = `Semana ${semanaAtual} - de ${formatPtDayMonth(inicioSemana)} a ${formatPtDayMonth(fimSemana)}`;

  const searchPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Buscar música</div>
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
          placeholder="Título ou artista (Spotify + catálogo)…"
          style={{
            width: "100%",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            color: "#1D1D1F",
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        {search.trim().length >= 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              Spotify
            </div>
            {spotifyLoading && <div style={{ fontSize: 13, color: "#86868B" }}>Buscando…</div>}
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
                return renderSongRow(song, added);
              })}
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
          Catálogo local
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((song) => {
            const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
            return renderSongRow(song, added);
          })}
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg, rgba(250,36,60,0.08), rgba(255,88,88,0.04))",
          borderRadius: 18,
          border: "1px solid rgba(250,36,60,0.1)",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 Regras</div>
        <ul style={{ fontSize: 13, color: "#6B6B70", lineHeight: 1.7, paddingLeft: 16 }}>
          <li>Adicione quantas músicas quiser e ordene arrastando</li>
          <li>Prazo: domingo 23:59 (BRT)</li>
          <li>Editável até a publicação</li>
          <li>A ordem define os pontos na Parada Global</li>
        </ul>
      </div>
    </div>
  );

  const chartList = (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{tituloParadaSemanaAno}</div>
          <div style={{ fontSize: 13, color: "#86868B", marginTop: 4 }}>
            {entries.length === 0 ? "Nenhuma música ainda" : `${entries.length} música${entries.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          type="button"
          onClick={importLastChart}
          disabled={importingLast}
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            color: "#1D1D1F",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: importingLast ? "not-allowed" : "pointer",
            opacity: importingLast ? 0.65 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {importingLast ? "Importando..." : "Importar última"}
        </button>
      </div>

      <div>
        {entries.map((song, i) => {
          const cover = coverForSong(song);
          return (
            <div
              key={`${song.title}-${song.artist}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "32px 36px 52px 1fr 32px" : "40px 44px 64px 1fr 40px 40px",
                alignItems: "center",
                padding: isMobile ? "10px 12px" : "10px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
                background: dragOver === i ? "rgba(250,36,60,0.04)" : "white",
                cursor: "grab",
                gap: 0,
              }}
            >
              <div style={{ color: "#C7C7CC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GripVertical size={16} />
              </div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: "-0.04em", color: "#000000", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 8 }}>
                {i + 1}
              </div>
              <div style={{ padding: "0 8px" }}>
                <Cover cover={cover} song={song} size={isMobile ? 36 : 48} rounded={8} />
              </div>
              <div style={{ minWidth: 0, padding: "0 8px" }}>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
              </div>
              {!isMobile && <div />}
              <button onClick={() => removeSong(i)} style={{ background: "none", border: "none", color: "#C7C7CC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#86868B", fontSize: 14 }}>
            {isMobile ? "Busque músicas abaixo e adicione à parada" : "Adicione músicas da busca ao lado →"}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Shell title={tituloParada}>
      <div style={{ maxWidth: 1100 }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
            <ChevronLeft size={16} />
            Voltar
          </Link>
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: isMobile ? 28 : 48, fontWeight: 800, letterSpacing: "-0.04em", margin: 0 }}>{tituloParada}</h1>
              <p style={{ fontSize: 14, color: "#86868B", marginTop: 6, marginBottom: 0 }}>{subtituloSemana}</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6B6B70", whiteSpace: "nowrap" }}>Semana</span>
                <input
                  type="date"
                  value={weekDate}
                  max={toInputDate(new Date())}
                  onChange={(e) => setWeekDate(e.target.value)}
                  style={{ border: "none", outline: "none", fontSize: 13, color: "#1D1D1F", background: "transparent" }}
                />
              </label>
              <button
                onClick={publishChart}
                disabled={publishing || entries.length === 0}
                style={{
                  background: entries.length === 0 ? "#E5E7EB" : "#FA243C",
                  color: entries.length === 0 ? "#9CA3AF" : "white",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 100,
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: entries.length > 0 ? "0 2px 8px rgba(250,36,60,0.25)" : "none",
                  cursor: publishing || entries.length === 0 ? "not-allowed" : "pointer",
                  opacity: publishing ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {publishing ? "Publicando…" : "Publicar parada"}
              </button>
            </div>
          </div>
        </div>

        {publishError && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(250,36,60,0.08)", border: "1px solid rgba(250,36,60,0.2)", borderRadius: 10, color: "#B91C1C", fontSize: 14 }}>
            {publishError}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {searchPanel}
            {chartList}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "flex-start" }}>
            {chartList}
            <div style={{ position: "sticky", top: 100 }}>
              {searchPanel}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
