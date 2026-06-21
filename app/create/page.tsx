"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, X, GripVertical, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { WeekCalendar } from "@/components/ui/WeekCalendar";
import { SONG_POOL, COVER_PALETTES } from "@/lib/data";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Cover as CoverModel, Song } from "@/lib/types";
import { buildDayLabelFromDate } from "@/lib/chart-cadence";
import { getChartWeekRange } from "@/lib/chart-week";
import { describeLastfmImportOrder, describeLastfmImportPeriod } from "@/lib/lastfm-import";
import { spotifyConnectErrorMessage } from "@/lib/spotify-connect-oauth";
import { isMyTrlOwner } from "@/lib/mytrl-access";

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

type DbSong = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  coverUrl: string | null;
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

const SPOTIFY_SEARCH_DISABLED = false;

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paradaIdFromUrl = searchParams.get("paradaId");
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const canUseSpotifyImport = isMyTrlOwner(session?.user?.handle);
  const [entries, setEntries] = useState<Song[]>([]);
  const [weekDate, setWeekDate] = useState(toInputDate(new Date()));
  const [dbQuery, setDbQuery] = useState("");
  const [lastfmQuery, setLastfmQuery] = useState("");
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [spotifyTracks, setSpotifyTracks] = useState<Song[]>([]);
  const [lastfmTracks, setLastfmTracks] = useState<Song[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [lastfmLoading, setLastfmLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [spotifyUnavailable, setSpotifyUnavailable] = useState(false);
  const [lastfmConfigured, setLastfmConfigured] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [importingLast, setImportingLast] = useState(false);
  const [importingLastfm, setImportingLastfm] = useState(false);
  const [paradaNome, setParadaNome] = useState<string | null>(null);
  const [activeParadaId, setActiveParadaId] = useState<string | null>(paradaIdFromUrl);
  const [showLastfmModal, setShowLastfmModal] = useState(false);
  const [lastfmImportCount, setLastfmImportCount] = useState(200);
  const [userLastfmUser, setUserLastfmUser] = useState<string | null>(null);
  const [userChartSize, setUserChartSize] = useState<number | null>(null);
  const [paradas, setParadas] = useState<Array<{ id: string; name: string; isPrimary: boolean; chartSize: number | null; cadence?: "weekly" | "daily" }>>([]);
  const [globalTopSongs, setGlobalTopSongs] = useState<Song[]>([]);
  const lastfmImportRunRef = useRef(0);
  const lastfmImportAbortRef = useRef<AbortController | null>(null);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);
  const [spotifyImportCount, setSpotifyImportCount] = useState(20);
  const [importingSpotify, setImportingSpotify] = useState(false);
  const [spotifyUserConnected, setSpotifyUserConnected] = useState(false);
  const spotifyImportRunRef = useRef(0);
  const spotifyImportAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/global/top")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { songs?: Array<{ id: string; title: string; artist: string; album: string; spotifyId: string | null; coverUrl: string | null }> } | null) => {
        if (!data?.songs?.length) return;
        setGlobalTopSongs(
          data.songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            spotifyId: s.spotifyId ?? undefined,
            imageUrl: s.coverUrl ?? undefined,
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/user/chart-name", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { paradaNome?: string | null; paradaId?: string | null; paradas?: Array<{ id: string; name: string; isPrimary?: boolean; chartSize?: number | null; cadence?: "weekly" | "daily" }> }) => {
        const allParadas = (data.paradas ?? []).map((p) => ({
          ...p,
          isPrimary: p.isPrimary ?? false,
          chartSize: p.chartSize ?? null,
          cadence: p.cadence ?? "weekly",
        }));
        setParadas(allParadas);
        const targetId = paradaIdFromUrl ?? data.paradaId ?? null;
        const match = allParadas.find((p) => p.id === targetId);
        const nome =
          match?.name ??
          (typeof data.paradaNome === "string" && data.paradaNome.trim() ? data.paradaNome.trim() : null);
        setParadaNome(nome);
        setActiveParadaId(targetId);
        const size = match?.chartSize ?? null;
        setUserChartSize(size);
        if (size) setLastfmImportCount(Math.min(200, size));
        if (!nome) router.replace(paradaIdFromUrl ? "/chart/setup?slot=2" : "/chart/setup");
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lastfmUser?: string | null; spotifyConnected?: boolean } | null) => {
        if (!data) return;
        setUserLastfmUser(data.lastfmUser ?? null);
        if (canUseSpotifyImport) setSpotifyUserConnected(data.spotifyConnected ?? false);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retorno do OAuth do Spotify iniciado a partir desta página (?spotify=connected|error|...).
  useEffect(() => {
    if (!canUseSpotifyImport) return;
    const status = searchParams.get("spotify");
    const reason = searchParams.get("spotify_reason");
    if (!status) return;
    if (status === "connected") {
      setSpotifyUserConnected(true);
      setShowSpotifyModal(true);
    } else {
      setPublishError(spotifyConnectErrorMessage(status, reason) ?? "Não foi possível conectar sua conta do Spotify. Tente novamente.");
    }
    // Limpa o parâmetro da URL sem recarregar.
    window.history.replaceState({}, "", "/create");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const resetDraft = () => {
      setEntries([]);
      setPublishError(null);
      setImportingLast(false);
      setImportingLastfm(false);
      setImportingSpotify(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Quando a página volta do histórico do navegador (bfcache),
      // limpamos o rascunho para evitar reaproveitar lista editada anterior.
      if (event.persisted) resetDraft();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

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
            }))
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
        const lfRes = await fetch(
          `/api/lastfm/search?q=${encodeURIComponent(q)}&limit=12`,
          { signal: ac.signal },
        );
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
                imageUrl: undefined,
                lastfmUrl: t.url ?? undefined,
              }))
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
  }, [lastfmQuery]);

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
      setSpotifyUnavailable(false);
      try {
        const spotifyRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=12`, {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (!spotifyRes.ok) {
          // 502/504 = Spotify temporariamente fora; não tratar como "não configurado"
          try {
            const errData = (await spotifyRes.json()) as { configured?: boolean };
            if (!ac.signal.aborted && errData.configured === false) {
              setSpotifyConfigured(false);
            } else if (!ac.signal.aborted) {
              setSpotifyUnavailable(true);
            }
          } catch {
            if (!ac.signal.aborted) setSpotifyUnavailable(true);
          }
          setSpotifyTracks([]);
        } else {
          try {
            const spotifyData = (await spotifyRes.json()) as {
              tracks?: SpotifyApiTrack[];
              configured?: boolean;
            };
            if (ac.signal.aborted) return;
            if (spotifyData.configured === false) {
              setSpotifyConfigured(false);
            } else {
              setSpotifyConfigured(true);
            }
            setSpotifyTracks(
              (spotifyData.tracks ?? []).map((t) => ({
                title: t.title,
                artist: t.artist,
                album: t.album,
                imageUrl: t.imageUrl ?? undefined,
                spotifyId: t.spotifyId,
              }))
            );
          } catch {
            if (ac.signal.aborted) return;
            setSpotifyUnavailable(true);
            setSpotifyTracks([]);
          }
        }
      } catch {
        if (ac.signal.aborted) return;
        setSpotifyUnavailable(true);
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
    if (!session?.user?.id) {
      setPublishError("Entre na sua conta para publicar. Use http://127.0.0.1:3000/login se o login não funcionar em localhost.");
      return;
    }
    if (entries.length === 0) {
      setPublishError("Adicione ao menos uma música antes de publicar.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const publishEntries = userChartSize ? entries.slice(0, userChartSize) : entries;
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          entries: publishEntries,
          weekDate,
          fastPublish: true,
          ...(activeParadaId ? { paradaId: activeParadaId } : {}),
        }),
      });
      const data = await res.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!res.ok) {
        if (res.status === 401) {
          setPublishError("Sessão expirada. Entre novamente em /login (prefira http://127.0.0.1:3000).");
          return;
        }
        if (res.status === 504 || res.status === 502) {
          setPublishError("A publicação demorou demais. Tente de novo — se persistir, publique com menos músicas de uma vez.");
          return;
        }
        setPublishError(data?.error ?? "Erro ao publicar parada.");
        return;
      }
      if (!data?.id) {
        setPublishError("Parada publicada, mas não foi possível abrir o detalhe. Veja no seu perfil.");
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
    const wd = weekDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wd)) {
      setPublishError(
        activeParadaCadence === "daily"
          ? "Selecione uma data válida no campo Data para importar a parada anterior."
          : "Selecione uma data válida no campo Data para importar a parada da semana anterior.",
      );
      return;
    }
    setImportingLast(true);
    setPublishError(null);
    try {
      const latestQ = new URLSearchParams({ weekDate: wd });
      if (activeParadaId) latestQ.set("paradaId", activeParadaId);
      const res = await fetch(`/api/charts/latest?${latestQ}`, { cache: "no-store" });
      const data = (await res.json()) as LatestChartResponse & { error?: string };
      if (!res.ok) {
        if (res.status === 404) {
          setPublishError(
            activeParadaCadence === "daily"
              ? "Não há parada publicada no dia anterior."
              : "Não há parada publicada na semana anterior à do campo Data.",
          );
          return;
        }
        if (res.status === 400) {
          setPublishError(data.error ?? "Data inválida.");
          return;
        }
        setPublishError(data.error ?? "Não foi possível importar a parada anterior.");
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
      setPublishError("Erro de conexão ao importar a parada anterior.");
    } finally {
      setImportingLast(false);
    }
  };

  const importFromLastfm = async (limit: number = 200) => {
    lastfmImportAbortRef.current?.abort();
    const runId = ++lastfmImportRunRef.current;
    const ac = new AbortController();
    lastfmImportAbortRef.current = ac;

    setShowLastfmModal(false);
    setEntries([]);
    setImportingLastfm(true);
    setPublishError(null);
    try {
      const requestNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(`/api/lastfm/import?ts=${Date.now()}&nonce=${encodeURIComponent(requestNonce)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, max-age=0",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ nonce: requestNonce, limit, weekDate: weekDate.trim() }),
        signal: ac.signal,
        cache: "no-store",
      });
      if (runId !== lastfmImportRunRef.current) return;

      const data = (await res.json()) as {
        songs?: Array<{ title: string; artist: string; album: string; spotifyId: string | null; imageUrl: string | null }>;
        error?: string;
      };
      if (!res.ok) {
        if (runId !== lastfmImportRunRef.current) return;
        setPublishError(data.error ?? "Erro ao importar do Last.fm.");
        return;
      }
      if (runId !== lastfmImportRunRef.current) return;

      const songs: Song[] = (data.songs ?? []).slice(0, limit).map((s) => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        spotifyId: s.spotifyId ?? undefined,
        imageUrl: s.imageUrl ?? undefined,
      }));
      setEntries(songs);
    } catch (e: unknown) {
      if (runId !== lastfmImportRunRef.current) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setPublishError("Erro de conexão ao importar do Last.fm.");
    } finally {
      if (runId === lastfmImportRunRef.current) setImportingLastfm(false);
    }
  };

  const importFromSpotify = async (limit: number = 20) => {
    spotifyImportAbortRef.current?.abort();
    const runId = ++spotifyImportRunRef.current;
    const ac = new AbortController();
    spotifyImportAbortRef.current = ac;

    setShowSpotifyModal(false);
    setEntries([]);
    setImportingSpotify(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/spotify/recent?ts=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ limit }),
        signal: ac.signal,
        cache: "no-store",
      });
      if (runId !== spotifyImportRunRef.current) return;

      const data = (await res.json()) as {
        songs?: Array<{ title: string; artist: string; album: string; spotifyId: string | null; imageUrl: string | null }>;
        error?: string;
        needsReconnect?: boolean;
      };
      if (!res.ok) {
        if (runId !== spotifyImportRunRef.current) return;
        // Token sem permissão / expirado: marcar como desconectado para exibir o botão de reconectar.
        if (data.needsReconnect) {
          setSpotifyUserConnected(false);
          setShowSpotifyModal(true);
        }
        setPublishError(data.error ?? "Erro ao importar do Spotify.");
        return;
      }
      if (runId !== spotifyImportRunRef.current) return;

      const songs: Song[] = (data.songs ?? []).slice(0, limit).map((s) => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        spotifyId: s.spotifyId ?? undefined,
        imageUrl: s.imageUrl ?? undefined,
      }));
      if (songs.length === 0) {
        setPublishError("Nenhuma música tocada recentemente encontrada no seu Spotify.");
        return;
      }
      setEntries(songs);
    } catch (e: unknown) {
      if (runId !== spotifyImportRunRef.current) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setPublishError("Erro de conexão ao importar do Spotify.");
    } finally {
      if (runId === spotifyImportRunRef.current) setImportingSpotify(false);
    }
  };

  const handleParadaChange = (paradaId: string) => {
    const parada = paradas.find((p) => p.id === paradaId);
    if (!parada) return;
    setActiveParadaId(paradaId);
    setParadaNome(parada.name);
    const size = parada.chartSize ?? null;
    setUserChartSize(size);
    if (size) setLastfmImportCount(Math.min(200, size));
    setEntries([]);
    setPublishError(null);
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
          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
            ) : song.lastfmUrl ? (
              <a
                href={song.lastfmUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
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

  const tituloParada = paradaNome ?? "Monte sua parada";
  const nomeParadaCard = paradaNome ?? "Sua parada";
  const activeParada = paradas.find((p) => p.id === activeParadaId);
  const activeParadaCadence = activeParada?.cadence ?? "weekly";
  const weekDateObj = fromInputDate(weekDate) ?? new Date();
  const semanaAtual = isoWeekNumber(weekDateObj);
  const anoSemanaIso = isoWeekYear(weekDateObj);
  const tituloParadaPeriodo =
    activeParadaCadence === "daily"
      ? `${nomeParadaCard} - ${buildDayLabelFromDate(weekDateObj)}`
      : `${nomeParadaCard} - Semana ${semanaAtual} - ${anoSemanaIso}`;
  const { start: inicioSemana, end: fimSemana } = getChartWeekRange(weekDateObj);
  const subtituloPeriodo =
    activeParadaCadence === "daily"
      ? buildDayLabelFromDate(weekDateObj)
      : `Semana ${semanaAtual} - de ${formatPtDayMonth(inicioSemana)} a ${formatPtDayMonth(fimSemana)}`;

  const searchPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Buscar música</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            Catálogo
          </div>
          <input
            value={dbQuery}
            onChange={(e) => setDbQuery(e.target.value)}
            placeholder="Pesquisar no catálogo local"
            style={{
              width: "100%",
              border: "1px solid var(--divider-strong)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              color: "var(--text)",
              background: "var(--fill-subtle)",
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {dbQuery.trim().length >= 2 ? (
            <>
              {dbLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}
              {!dbLoading &&
                (dbSongs.length > 0 ? (
                  dbSongs.map((song) => {
                    const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                    return renderSongRow(song, added);
                  })
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma música no catálogo.</div>
                ))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.45 }}>
                Digite ao menos 2 caracteres para buscar no catálogo completo.{globalTopSongs.length > 0 ? " Mais tocadas dos últimos 30 dias:" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {(globalTopSongs.length > 0 ? globalTopSongs : SONG_POOL.slice(0, 5)).map((song) => {
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
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Last.fm
            </div>
          </div>
          <input
            value={lastfmQuery}
            onChange={(e) => setLastfmQuery(e.target.value)}
            placeholder="Pesquisar no Last.fm"
            style={{
              width: "100%",
              border: "1px solid var(--divider-strong)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              color: "var(--text)",
              background: "var(--fill-subtle)",
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {lastfmQuery.trim().length < 1 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Digite para pesquisar no Last.fm.</div>
          ) : (
            <>
              {lastfmLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}
              {!lastfmLoading && !lastfmConfigured && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Configure <code style={{ fontSize: 11 }}>API_KEY</code> (Last.fm) no arquivo <code style={{ fontSize: 11 }}>.env</code>.
                </div>
              )}
              {!lastfmLoading && lastfmConfigured && lastfmTracks.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum resultado no Last.fm.</div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            Spotify
          </div>
          <input
            value={spotifyQuery}
            onChange={(e) => setSpotifyQuery(e.target.value)}
            placeholder={SPOTIFY_SEARCH_DISABLED ? "Spotify desativado temporariamente" : "Pesquisar no Spotify"}
            disabled={SPOTIFY_SEARCH_DISABLED}
            style={{
              width: "100%",
              border: "1px solid var(--divider-strong)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              color: "var(--text)",
              background: "var(--fill-subtle)",
              opacity: SPOTIFY_SEARCH_DISABLED ? 0.5 : 1,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {SPOTIFY_SEARCH_DISABLED ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Busca no Spotify está desativada no momento.</div>
          ) : spotifyQuery.trim().length < 1 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Digite para pesquisar no Spotify.</div>
          ) : (
            <>
              {spotifyLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}
              {!spotifyLoading && !spotifyConfigured && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Configure <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_ID</code> e <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_SECRET</code> no arquivo{" "}
                  <code style={{ fontSize: 11 }}>.env</code>.
                </div>
              )}
              {!spotifyLoading && spotifyConfigured && spotifyUnavailable && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Spotify indisponível no momento. Tente novamente.</div>
              )}
              {!spotifyLoading && spotifyConfigured && !spotifyUnavailable && spotifyTracks.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum resultado no Spotify.</div>
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
          <li>A ordem reflete o que mais marcou sua semana</li>
        </ul>
      </div>
    </div>
  );

  const chartList = (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{tituloParadaPeriodo}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {entries.length === 0 ? "Nenhuma música ainda" : `${entries.length} música${entries.length === 1 ? "" : "s"}`}
          </div>
        </div>
        {session?.user && (
          <>
            <button
              type="button"
              onClick={() => !importingLastfm && setShowLastfmModal(true)}
              disabled={importingLastfm}
              title="Importar do Last.fm conforme a data da parada selecionada"
              style={{
                border: "1px solid rgba(250,36,60,0.3)",
                background: importingLastfm ? "rgba(250,36,60,0.05)" : "rgba(250,36,60,0.06)",
                color: "#FA243C",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: importingLastfm ? "not-allowed" : "pointer",
                opacity: importingLastfm ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {importingLastfm ? "Buscando Last.fm…" : "↺ Last.fm"}
            </button>
            {canUseSpotifyImport && (
            <button
              type="button"
              onClick={() => !importingSpotify && setShowSpotifyModal(true)}
              disabled={importingSpotify}
              title="Importar suas músicas tocadas recentemente no Spotify"
              style={{
                border: "1px solid rgba(30,215,96,0.35)",
                background: importingSpotify ? "rgba(30,215,96,0.05)" : "rgba(30,215,96,0.08)",
                color: "#1DB954",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: importingSpotify ? "not-allowed" : "pointer",
                opacity: importingSpotify ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {importingSpotify ? "Buscando Spotify…" : "↺ Spotify"}
            </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={importLastChart}
          disabled={importingLast}
          title={
            activeParadaCadence === "daily"
              ? "Copia a parada que você publicou no dia imediatamente anterior ao do campo Data"
              : "Copia a parada que você publicou na semana ISO imediatamente anterior à do campo Data"
          }
          style={{
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: importingLast ? "not-allowed" : "pointer",
            opacity: importingLast ? 0.65 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {importingLast ? "Importando..." : "Importar anterior"}
        </button>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setEntries([])}
            disabled={importingLastfm || importingLast || importingSpotify}
            title="Limpar todas as músicas da lista"
            style={{
              border: "1px solid var(--divider-strong)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: importingLastfm || importingLast || importingSpotify ? "not-allowed" : "pointer",
              opacity: importingLastfm || importingLast || importingSpotify ? 0.65 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Limpar lista
          </button>
        )}
      </div>

      <div>
        {entries.map((song, i) => {
          const cover = coverForSong(song);
          const isBeyondCut = userChartSize !== null && i >= userChartSize;
          return (
            <div key={`${song.title}-${song.artist}-${i}`}>
              {userChartSize !== null && i === userChartSize && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "6px 12px" : "6px 20px", background: "rgba(250,36,60,0.04)" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(250,36,60,0.25)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FA243C", whiteSpace: "nowrap" }}>
                    Corte da parada · posição {userChartSize}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(250,36,60,0.25)" }} />
                </div>
              )}
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "32px 36px 52px 1fr 32px" : "40px 44px 64px 1fr 40px 40px",
                  alignItems: "center",
                  padding: isMobile ? "10px 12px" : "10px 20px",
                  borderBottom: "1px solid var(--divider-soft)",
                  background: dragOver === i ? "var(--accent-tint)" : isBeyondCut ? "var(--fill-inset)" : "var(--surface)",
                  cursor: "grab",
                  gap: 0,
                  opacity: isBeyondCut ? 0.45 : 1,
                }}
              >
                <div style={{ color: "var(--text-disabled)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <GripVertical size={16} />
                </div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 8 }}>
                  {i + 1}
                </div>
                <div style={{ padding: "0 8px" }}>
                  <Cover cover={cover} song={song} size={isMobile ? 36 : 48} rounded={8} />
                </div>
                <div style={{ minWidth: 0, padding: "0 8px" }}>
                  <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
                </div>
                {!isMobile && <div />}
                <button onClick={() => removeSong(i)} style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={18} />
                </button>
              </div>
            </div>
          );
        })}
        {userChartSize !== null && entries.length > userChartSize && (
          <div style={{ padding: "10px 16px", background: "rgba(250,36,60,0.05)", borderTop: "1px solid rgba(250,36,60,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#FA243C", fontWeight: 600 }}>
              {entries.length - userChartSize} música{entries.length - userChartSize === 1 ? "" : "s"} além do tamanho da parada serão descartadas ao publicar.
            </span>
          </div>
        )}
        {entries.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {isMobile ? "Use a busca de músicas re adicione à parada" : "Adicione músicas da busca ao lado →"}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Shell title="">
      <div style={{ maxWidth: 1100 }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
            <ChevronLeft size={16} />
            Voltar
          </Link>
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: isMobile ? 28 : 48, fontWeight: 800, letterSpacing: "-0.04em", margin: 0 }}>{tituloParada}</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>{subtituloPeriodo}</p>
              {paradas.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {paradas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleParadaChange(p.id)}
                      style={{
                        padding: "4px 14px",
                        borderRadius: 100,
                        border: activeParadaId === p.id ? "none" : "1px solid var(--divider-strong)",
                        background: activeParadaId === p.id ? "var(--accent)" : "var(--surface)",
                        color: activeParadaId === p.id ? "white" : "var(--text)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <WeekCalendar
                value={weekDate}
                onChange={setWeekDate}
                paradaId={activeParadaId}
                mode={activeParadaCadence}
                label={activeParadaCadence === "daily" ? "Dia" : "Semana"}
              />
              <button
                onClick={publishChart}
                disabled={publishing || entries.length === 0}
                style={{
                  background: entries.length === 0 ? "var(--fill-subtle)" : "var(--accent)",
                  color: entries.length === 0 ? "var(--text-disabled)" : "white",
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

      {/* Modal de importação do Last.fm */}
      {showLastfmModal && (
        <div
          onClick={() => setShowLastfmModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: isMobile ? "20px 20px 0 0" : 20,
              padding: isMobile ? "28px 20px 32px" : "32px 28px",
              width: "100%",
              maxWidth: isMobile ? "100%" : 480,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Handle para bottom sheet mobile */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: -12, marginBottom: -8 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
              </div>
            )}

            {/* Título */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(250,36,60,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  ↺
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Importar do Last.fm</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {describeLastfmImportPeriod(weekDate)}
              </p>
            </div>

            {/* Conta Last.fm */}
            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              {userLastfmUser ? (
                <>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FA243C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 14, color: "white", fontWeight: 800 }}>♪</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Conta Last.fm</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>@{userLastfmUser}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(250,36,60,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    ⚠️
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#B91C1C" }}>Usuário Last.fm não configurado</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Configure nas{" "}
                      <a href="/settings" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
                        configurações de perfil
                      </a>
                      {" "}para usar esta função.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quantidade de músicas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                Quantas músicas importar?
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={lastfmImportCount}
                  onChange={(e) => setLastfmImportCount(Number(e.target.value))}
                  disabled={!userLastfmUser}
                  style={{ flex: 1, accentColor: "#FA243C", cursor: userLastfmUser ? "pointer" : "not-allowed" }}
                />
                <div style={{
                  minWidth: 52,
                  textAlign: "center",
                  background: "rgba(250,36,60,0.06)",
                  border: "1px solid rgba(250,36,60,0.2)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#FA243C",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {lastfmImportCount}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {describeLastfmImportOrder(weekDate)}
              </div>
            </div>

            {/* Info sobre tamanho da parada */}
            <div style={{
              background: userChartSize ? "rgba(250,36,60,0.04)" : "rgba(0,0,0,0.03)",
              border: userChartSize ? "1px solid rgba(250,36,60,0.15)" : "1px solid rgba(0,0,0,0.06)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{userChartSize ? "✂️" : "ℹ️"}</span>
              <div>
                {userChartSize ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                      Sua parada tem {userChartSize} posições
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
                      Ao publicar, músicas além da {userChartSize}ª posição serão automaticamente descartadas. Importe mais músicas para ter opções e reordene a lista antes de publicar.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                      Tamanho da parada não definido
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
                      Defina o tamanho da sua parada nas{" "}
                      <a href="/settings" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>configurações</a>
                      {" "}para que o corte seja aplicado automaticamente ao publicar.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowLastfmModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 100,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#1D1D1F",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => importFromLastfm(lastfmImportCount)}
                disabled={!userLastfmUser}
                style={{
                  padding: "10px 20px",
                  borderRadius: 100,
                  border: "none",
                  background: userLastfmUser ? "var(--accent)" : "var(--fill-subtle)",
                  color: userLastfmUser ? "white" : "var(--text-disabled)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: userLastfmUser ? "pointer" : "not-allowed",
                  boxShadow: userLastfmUser ? "0 2px 8px rgba(250,36,60,0.3)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                Importar {lastfmImportCount} música{lastfmImportCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de importação do Spotify */}
      {canUseSpotifyImport && showSpotifyModal && (
        <div
          onClick={() => setShowSpotifyModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: isMobile ? "20px 20px 0 0" : 20,
              padding: isMobile ? "28px 20px 32px" : "32px 28px",
              width: "100%",
              maxWidth: isMobile ? "100%" : 480,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: -12, marginBottom: -8 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
              </div>
            )}

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(30,215,96,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  ↺
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Importar do Spotify</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Suas músicas tocadas mais recentemente no Spotify serão importadas na ordem em que foram ouvidas.
              </p>
            </div>

            <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              {spotifyUserConnected ? (
                <>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1DB954", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 14, color: "white", fontWeight: 800 }}>♪</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Conta Spotify</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Conectada</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(30,215,96,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    ⚠️
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#15803D" }}>Conta Spotify não conectada</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Conecte sua conta para importar suas músicas recentes.
                    </div>
                  </div>
                  <a
                    href="/api/spotify/connect?from=/create"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      borderRadius: 100,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "white",
                      background: "#1DB954",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>♪</span> Conectar
                  </a>
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                Quantas músicas importar?
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={1}
                  value={spotifyImportCount}
                  onChange={(e) => setSpotifyImportCount(Number(e.target.value))}
                  disabled={!spotifyUserConnected}
                  style={{ flex: 1, accentColor: "#1DB954", cursor: spotifyUserConnected ? "pointer" : "not-allowed" }}
                />
                <div style={{
                  minWidth: 52,
                  textAlign: "center",
                  background: "rgba(30,215,96,0.08)",
                  border: "1px solid rgba(30,215,96,0.25)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#1DB954",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {spotifyImportCount}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                De 10 a 50 músicas. Ordenadas da mais recente para a mais antiga.
              </div>
            </div>

            {userChartSize && (
              <div style={{
                background: "rgba(30,215,96,0.04)",
                border: "1px solid rgba(30,215,96,0.15)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>✂️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                    Sua parada tem {userChartSize} posições
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
                    Ao publicar, músicas além da {userChartSize}ª posição serão descartadas. Reordene antes de publicar.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowSpotifyModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 100,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#1D1D1F",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => importFromSpotify(spotifyImportCount)}
                disabled={!spotifyUserConnected}
                style={{
                  padding: "10px 20px",
                  borderRadius: 100,
                  border: "none",
                  background: spotifyUserConnected ? "#1DB954" : "var(--fill-subtle)",
                  color: spotifyUserConnected ? "white" : "var(--text-disabled)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: spotifyUserConnected ? "pointer" : "not-allowed",
                  boxShadow: spotifyUserConnected ? "0 2px 8px rgba(30,215,96,0.35)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                Importar {spotifyImportCount} música{spotifyImportCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
