"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, GripVertical, Plus, X, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { WeekCalendar } from "@/components/ui/WeekCalendar";
import { SONG_POOL, COVER_PALETTES } from "@/lib/data";
import { buildDayLabelFromDate } from "@/lib/chart-cadence";
import { buildDateRangeFromDate, buildWeekLabelFromDate } from "@/lib/chart-week";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileReorder } from "@/hooks/useMobileReorder";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import {
  MobileReorderListRow,
  MobileReorderPositionSheet,
  MobileReorderToolbar,
} from "@/components/mobile-reorder";
import type { Song, Cover as CoverModel, Chart } from "@/lib/types";
import { useTranslations } from "@/hooks/useTranslations";


type ChartDetailResponse = {
  user: { id: string; handle: string; name: string };
  chart: Pick<Chart, "id" | "weekLabel" | "dateRange" | "entries">;
  lastfmImportWeekDate?: string | null;
  paradaId?: string;
  paradaCadence?: "weekly" | "daily";
};

function fromInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

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
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "DEV";
  const raw = params?.id;
  const chartId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingLastfm, setImportingLastfm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekDate, setWeekDate] = useState("");
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [paradaCadence, setParadaCadence] = useState<"weekly" | "daily">("weekly");
  const [entries, setEntries] = useState<Song[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const mobileReorder = useMobileReorder({
    items: entries,
    onChange: setEntries,
    getItemLabel: (song) => song.title,
  });
  const [dbQuery, setDbQuery] = useState("");
  const [lastfmQuery, setLastfmQuery] = useState("");
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [lastfmTracks, setLastfmTracks] = useState<Song[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [lastfmLoading, setLastfmLoading] = useState(false);
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  const {
    tracks: spotifyTracks,
    loading: spotifyLoading,
    configured: spotifyConfigured,
    unavailable: spotifyUnavailable,
  } = useSpotifySearch(spotifyQuery, SPOTIFY_SEARCH_DISABLED);
  const [lastfmConfigured, setLastfmConfigured] = useState(true);
  const lastfmImportRunRef = useRef(0);
  const lastfmImportAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!chartId) return;
    setLoading(true);
    fetch(`/api/charts/${encodeURIComponent(chartId)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error(t("chart.cannotEdit"));
          throw new Error(t("chart.edit.loadError"));
        }
        const data = (await res.json()) as ChartDetailResponse;
        setParadaId(data.paradaId ?? null);
        setParadaCadence(data.paradaCadence ?? "weekly");
        if (data.lastfmImportWeekDate) setWeekDate(data.lastfmImportWeekDate);
        setEntries(
          data.chart.entries.map((e) => ({
            id: e.song.id,
            title: e.song.title,
            artist: e.song.artist,
            album: e.song.album ?? "",
            spotifyId: e.song.spotifyId ?? undefined,
            imageUrl: e.song.imageUrl ?? e.cover?.imageUrl ?? undefined,
            slugArtist: e.song.slugArtist,
            artistRefId: e.song.artistRefId ?? undefined,
            albumRefId: e.song.albumRefId ?? undefined,
            lastfmUrl: e.song.lastfmUrl ?? undefined,
          })),
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [chartId]);

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
        const dbRes = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" });
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
        const lfRes = await fetch(`/api/lastfm/search?q=${encodeURIComponent(q)}&limit=12`, {
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
                imageUrl: undefined,
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
  }, [lastfmQuery]);

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

  const clearDrag = () => {
    setDragIndex(null);
    setDragOver(null);
  };

  const importFromLastfm = async () => {
    lastfmImportAbortRef.current?.abort();
    const runId = ++lastfmImportRunRef.current;
    const ac = new AbortController();
    lastfmImportAbortRef.current = ac;

    setImportingLastfm(true);
    setError(null);
    try {
      const requestNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(`/api/lastfm/import?ts=${Date.now()}&nonce=${encodeURIComponent(requestNonce)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, max-age=0",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ nonce: requestNonce, weekDate: weekDate || undefined }),
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
        setError(data.error ?? t("chart.edit.lastfmImportError"));
        return;
      }
      if (runId !== lastfmImportRunRef.current) return;

      const songs: Song[] = (data.songs ?? []).slice(0, 200).map((s) => ({
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
      setError(t("chart.edit.lastfmConnectionError"));
    } finally {
      if (runId === lastfmImportRunRef.current) setImportingLastfm(false);
    }
  };

  const saveChart = async () => {
    if (!chartId) return;
    if (entries.length === 0) {
      setError(t("chart.edit.addOneSong"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/charts/${chartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          entries: entries.map((e) => ({
            title: e.title,
            artist: e.artist,
            album: e.album,
            spotifyId: e.spotifyId ?? null,
            songId: e.id ?? null,
            imageUrl: e.imageUrl ?? null,
          })),
          ...(weekDate ? { weekDate } : {}),
        }),
      });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        if (res.status === 502 || res.status === 504) {
          setError(t("chart.edit.saveTimeout"));
          return;
        }
        setError(data?.error ?? t("chart.edit.saveError"));
        return;
      }
      router.push(`/chart/${chartId}`);
    } catch {
      setError(t("chart.edit.saveConnectionError"));
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
          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{song.artist}</span>
            {song.spotifyId ? (
              <a
                href={`https://open.spotify.com/track/${song.spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                style={{ color: "#1DB954", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600 }}
                title={t("chart.edit.openSpotify")}
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
                title={t("chart.edit.openLastfm")}
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
            background: added ? "var(--up-bg)" : "var(--accent)",
            color: added ? "var(--up-fg)" : "white",
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{t("chart.edit.searchSongTitle")}</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
          {t("chart.edit.catalogLabel")}
        </div>
        <input
          value={dbQuery}
          onChange={(e) => setDbQuery(e.target.value)}
          placeholder={t("create.searchLocal")}
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
            {dbLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.searching")}</div>}
            {!dbLoading &&
              (dbSongs.length > 0 ? (
                dbSongs.map((song) => {
                  const added = entries.some((e) => e.title === song.title && e.artist === song.artist);
                  return renderSongRow(song, added);
                })
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("create.noCatalogSongs")}</div>
              ))}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.45 }}>
              {t("chart.edit.catalogHint")}
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
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            color: "var(--text)",
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
          {t("chart.edit.spotifyLabel")}
        </div>
        <input
          value={spotifyQuery}
          onChange={(e) => setSpotifyQuery(e.target.value)}
          placeholder={SPOTIFY_SEARCH_DISABLED ? t("chart.edit.spotifySearchDisabledPlaceholder") : t("chart.edit.spotifySearchPlaceholder")}
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
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.spotifySearchDisabledBody")}</div>
        ) : spotifyQuery.trim().length < 1 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.typeToSearchSpotify")}</div>
        ) : (
          <>
            {spotifyLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.searching")}</div>}
            {!spotifyLoading && !spotifyConfigured && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {t("chart.edit.spotifyConfigMissingPrefix")} <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_ID</code> {t("chart.edit.spotifyConfigMissingMiddle")} <code style={{ fontSize: 11 }}>SPOTIFY_CLIENT_SECRET</code> {t("chart.edit.spotifyConfigMissingSuffix")}{" "}
                <code style={{ fontSize: 11 }}>.env</code>.
              </div>
            )}
            {!spotifyLoading && spotifyConfigured && spotifyUnavailable && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.spotifyUnavailable")}</div>
            )}
            {!spotifyLoading && spotifyConfigured && !spotifyUnavailable && spotifyTracks.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.noSpotifyResults")}</div>
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
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden", position: "relative" }}>
      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>{t("chart.edit.topCount", { count: entries.length })}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {isAdmin && (
            <button
              type="button"
              onClick={importFromLastfm}
              disabled={importingLastfm}
              title={t("chart.edit.lastfmImportTooltip")}
              style={{
                border: "1px solid rgba(250,36,60,0.3)",
                background: importingLastfm ? "rgba(250,36,60,0.05)" : "rgba(250,36,60,0.06)",
                color: "#FA243C",
                borderRadius: 100,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: importingLastfm ? "not-allowed" : "pointer",
                opacity: importingLastfm ? 0.55 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {importingLastfm ? t("chart.edit.lastfmImporting") : "↺ Last.fm"}
            </button>
          )}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setEntries([])}
              disabled={saving}
              title={t("chart.edit.clearAllTooltip")}
              style={{
                border: "1px solid var(--divider-strong)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                borderRadius: 100,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.55 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {t("chart.edit.clearList")}
            </button>
          )}
          <button
            onClick={saveChart}
            disabled={saving || entries.length === 0}
            style={{
              background: entries.length === 0 ? "var(--fill-subtle)" : "var(--accent)",
              color: entries.length === 0 ? "var(--text-disabled)" : "white",
              border: "none",
              padding: "9px 18px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || entries.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {saving ? t("chart.saving") : t("chart.saveEdit")}
          </button>
        </div>
      </div>
      {isMobile && entries.length > 0 && (
        <MobileReorderToolbar
          mode={mobileReorder.mode}
          onModeChange={mobileReorder.setMode}
          hint={mobileReorder.hint}
          showSwapBanner={mobileReorder.showSwapBanner}
          swapBannerTitle={mobileReorder.selectedTitle ?? undefined}
          onCancelSwap={mobileReorder.cancelSelection}
        />
      )}
      {entries.map((song, i) => {
        const cover = coverForSong(song);
        if (!isMobile) {
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
              onDragEnd={clearDrag}
              style={{
                display: "grid",
                gridTemplateColumns: "38px 44px 56px 1fr 36px",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: "1px solid var(--divider-soft)",
                background: dragOver === i ? "var(--accent-tint)" : "var(--surface)",
                cursor: "grab",
              }}
            >
              <div style={{ color: "var(--text-disabled)", display: "flex", justifyContent: "center" }}>
                <GripVertical size={16} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, textAlign: "right" }}>{i + 1}</div>
              <div style={{ padding: "0 8px" }}>
                <Cover cover={cover} song={song} size={42} rounded={8} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
              </div>
              <button
                type="button"
                onClick={() => removeSong(i)}
                style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", display: "flex", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>
          );
        }

        const rowProps = mobileReorder.getRowProps(i);
        return (
          <MobileReorderListRow
            key={`${song.id ?? ""}-${song.title}-${song.artist}-${i}`}
            position={i + 1}
            cover={<Cover cover={cover} song={song} size={36} rounded={8} />}
            title={song.title}
            artist={song.artist}
            mode={mobileReorder.mode}
            rowProps={rowProps}
            onRemove={() => removeSong(i)}
          />
        );
      })}
      {isMobile && mobileReorder.showPositionSheet && mobileReorder.editTargetTitle ? (
        <MobileReorderPositionSheet
          title={mobileReorder.editTargetTitle}
          currentPosition={(mobileReorder.editTargetIndex ?? 0) + 1}
          maxPosition={mobileReorder.itemCount}
          onConfirm={mobileReorder.confirmPosition}
          onClose={mobileReorder.closePositionSheet}
        />
      ) : null}
      {entries.length === 0 && !loading && (
        <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {isMobile ? t("chart.edit.emptyMobile") : t("chart.edit.emptyDesktop")}
        </div>
      )}
    </div>
  );

  const weekDateObj = fromInputDate(weekDate);
  const periodLabel =
    weekDateObj && paradaCadence === "daily"
      ? buildDayLabelFromDate(weekDateObj)
      : weekDateObj
        ? `${buildWeekLabelFromDate(weekDateObj)} · ${buildDateRangeFromDate(weekDateObj)}`
        : null;

  return (
    <Shell title="">
      <div>
        <Link
          href={`/chart/${chartId}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14, textDecoration: "none", marginBottom: 12 }}
        >
          <ChevronLeft size={16} />
          {t("chart.edit.backToChart")}
        </Link>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", margin: 0 }}>{t("chart.editTitle")}</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          {periodLabel ? (
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{periodLabel}</p>
          ) : (
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{t("chart.edit.loadingPeriod")}</p>
          )}
          {!loading && weekDate ? (
            <WeekCalendar
              value={weekDate}
              onChange={setWeekDate}
              paradaId={paradaId}
              mode={paradaCadence}
              label={paradaCadence === "daily" ? t("create.day") : t("create.week")}
            />
          ) : null}
        </div>

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
          <div style={{ marginTop: 24, color: "var(--text-muted)" }}>{t("chart.loading")}</div>
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
