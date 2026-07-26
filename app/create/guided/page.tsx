"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "@/hooks/useTranslations";
import { ChevronLeft, ChevronRight, GripVertical, Plus, X, Check } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import { WeekCalendar } from "@/components/ui/WeekCalendar";
import { SpotlightSearchCard } from "@/components/create/SpotlightSearchCard";
import { ManualSongCreateModal } from "@/components/create/ManualSongCreateModal";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileReorder } from "@/hooks/useMobileReorder";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import {
  MobileReorderListRow,
  MobileReorderPositionSheet,
  MobileReorderToolbar,
} from "@/components/mobile-reorder";
import { COVER_PALETTES } from "@/lib/data";
import type { Cover as CoverModel, Song } from "@/lib/types";
import { buildDayLabelFromDate } from "@/lib/chart-cadence";
import { getChartWeekRange } from "@/lib/chart-week";

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
  const palette = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  const base: CoverModel = { palette, seed: Math.abs(hash) };
  return song.imageUrl ? { ...base, imageUrl: song.imageUrl } : base;
}

function formatPtDayMonth(date: Date): string {
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${date.getDate()} de ${monthCap}`;
}

type ParadaOption = { id: string; name: string; isPrimary: boolean; chartSize: number | null; cadence: "weekly" | "daily" };

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
  entries: Array<{ title: string; artist: string; album: string; spotifyId: string | null }>;
  error?: string;
};

type Method = "lastfm" | "manual" | "previous" | null;

function StepBar({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, flex: n < labels.length ? 1 : undefined }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                background: done || active ? "var(--accent)" : "var(--fill-subtle)",
                color: done || active ? "#fff" : "var(--text-muted)",
              }}
            >
              {done ? <Check size={13} /> : n}
            </div>
            <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "var(--text)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
              {label}
            </div>
            {n < labels.length && <div style={{ flex: 1, height: 1, background: "var(--divider)" }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function GuidedCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const { t } = useTranslations();
  const paradaIdFromUrl = searchParams.get("paradaId");
  const stepLabels = [t("createGuided.stepParada"), t("createGuided.stepMetodo"), t("createGuided.stepMusicas"), t("createGuided.stepPublicar")];

  const [step, setStep] = useState(1);

  // Passo 1 — parada + período
  const [loadingParadas, setLoadingParadas] = useState(true);
  const [paradas, setParadas] = useState<ParadaOption[]>([]);
  const [activeParadaId, setActiveParadaId] = useState<string | null>(paradaIdFromUrl);
  const [newParadaName, setNewParadaName] = useState("");
  const [creatingParada, setCreatingParada] = useState(false);
  const [weekDate, setWeekDate] = useState(toInputDate(new Date()));
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Passo 2 — método
  const [method, setMethod] = useState<Method>(null);
  const [userLastfmUser, setUserLastfmUser] = useState<string | null>(null);
  const [importingLastfm, setImportingLastfm] = useState(false);
  const [importingPrevious, setImportingPrevious] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const lastfmImportAbortRef = useRef<AbortController | null>(null);

  // Passo 3 — músicas
  const [entries, setEntries] = useState<Song[]>([]);
  const [dbQuery, setDbQuery] = useState("");
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const { tracks: spotifyTracks, loading: spotifyLoading, configured: spotifyConfigured, unavailable: spotifyUnavailable } = useSpotifySearch(spotifyQuery);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const mobileReorder = useMobileReorder({ items: entries, onChange: setEntries, getItemLabel: (song) => song.title });

  // Passo 4 — extras + publicar
  const [flashbackSong, setFlashbackSong] = useState<Song | null>(null);
  const [destaqueSong, setDestaqueSong] = useState<Song | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingParadas(true);
    fetch("/api/user/chart-name", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { paradaNome?: string | null; paradaId?: string | null; paradas?: Array<{ id: string; name: string; isPrimary?: boolean; chartSize?: number | null; cadence?: "weekly" | "daily" }> }) => {
        const allParadas: ParadaOption[] = (data.paradas ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          isPrimary: p.isPrimary ?? false,
          chartSize: p.chartSize ?? null,
          cadence: p.cadence ?? "weekly",
        }));
        setParadas(allParadas);
        const targetId = paradaIdFromUrl ?? data.paradaId ?? allParadas[0]?.id ?? null;
        setActiveParadaId(allParadas.some((p) => p.id === targetId) ? targetId : allParadas[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingParadas(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lastfmUser?: string | null; lastfmImportUser?: string | null } | null) => {
        if (!data) return;
        setUserLastfmUser(data.lastfmImportUser ?? data.lastfmUser ?? null);
      })
      .catch(() => {});
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
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" });
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setDbSongs([]);
        } else {
          const data = (await res.json()) as { songs?: DbSong[] };
          if (ac.signal.aborted) return;
          setDbSongs(
            (data.songs ?? []).map((s) => ({
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

  const activeParada = paradas.find((p) => p.id === activeParadaId) ?? null;
  const activeParadaCadence = activeParada?.cadence ?? "weekly";
  const userChartSize = activeParada?.chartSize ?? null;
  const weekDateObj = fromInputDate(weekDate) ?? new Date();
  const { start: inicioSemana, end: fimSemana } = getChartWeekRange(weekDateObj);
  const periodoLabel =
    activeParadaCadence === "daily"
      ? buildDayLabelFromDate(weekDateObj)
      : `${formatPtDayMonth(inicioSemana)} - ${formatPtDayMonth(fimSemana)}`;

  const handleCreateFirstParada = async () => {
    const trimmed = newParadaName.trim();
    if (trimmed.length < 2) {
      setStep1Error(t("createGuided.nameTooShort"));
      return;
    }
    setCreatingParada(true);
    setStep1Error(null);
    try {
      const res = await fetch("/api/user/chart-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paradaNome: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStep1Error(data?.error ?? t("createGuided.saveNameError"));
        return;
      }
      const refreshed = await fetch("/api/user/chart-name", { cache: "no-store" }).then((r) => r.json());
      const allParadas: ParadaOption[] = (refreshed.paradas ?? []).map((p: { id: string; name: string; isPrimary?: boolean; chartSize?: number | null; cadence?: "weekly" | "daily" }) => ({
        id: p.id,
        name: p.name,
        isPrimary: p.isPrimary ?? false,
        chartSize: p.chartSize ?? null,
        cadence: p.cadence ?? "weekly",
      }));
      setParadas(allParadas);
      setActiveParadaId(refreshed.paradaId ?? allParadas[0]?.id ?? null);
    } catch {
      setStep1Error(t("createGuided.connectionError"));
    } finally {
      setCreatingParada(false);
    }
  };

  const goStep2 = () => {
    if (!activeParadaId) {
      setStep1Error(t("createGuided.selectParadaError"));
      return;
    }
    setStep1Error(null);
    setStep(2);
  };

  const importFromLastfm = async () => {
    lastfmImportAbortRef.current?.abort();
    const ac = new AbortController();
    lastfmImportAbortRef.current = ac;
    setImportingLastfm(true);
    setStep2Error(null);
    try {
      const requestNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const limit = userChartSize ? Math.min(200, userChartSize) : 200;
      const res = await fetch(`/api/lastfm/import?ts=${Date.now()}&nonce=${encodeURIComponent(requestNonce)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, max-age=0", Pragma: "no-cache" },
        body: JSON.stringify({ nonce: requestNonce, limit, weekDate: weekDate.trim(), filterNewHits: false, period: "30days" }),
        signal: ac.signal,
        cache: "no-store",
      });
      const data = (await res.json()) as {
        songs?: Array<{ title: string; artist: string; album: string; spotifyId: string | null; imageUrl: string | null }>;
        error?: string;
      };
      if (!res.ok) {
        setStep2Error(data.error ?? t("chart.edit.lastfmImportError"));
        return;
      }
      const songs: Song[] = (data.songs ?? []).slice(0, limit).map((s) => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        spotifyId: s.spotifyId ?? undefined,
        imageUrl: s.imageUrl ?? undefined,
      }));
      setMethod("lastfm");
      setEntries(songs);
      setStep(3);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setStep2Error(t("chart.edit.lastfmConnectionError"));
    } finally {
      setImportingLastfm(false);
    }
  };

  const importPrevious = async () => {
    const wd = weekDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wd)) {
      setStep2Error(activeParadaCadence === "daily" ? t("create.selectValidDateDaily") : t("create.selectValidDateWeekly"));
      return;
    }
    setImportingPrevious(true);
    setStep2Error(null);
    try {
      const q = new URLSearchParams({ weekDate: wd });
      if (activeParadaId) q.set("paradaId", activeParadaId);
      const res = await fetch(`/api/charts/latest?${q}`, { cache: "no-store" });
      const data = (await res.json()) as LatestChartResponse;
      if (!res.ok) {
        setStep2Error(
          res.status === 404
            ? (activeParadaCadence === "daily" ? t("create.noPrevDayChart") : t("create.noPrevWeekChart"))
            : data.error ?? t("create.importPrevError"),
        );
        return;
      }
      setMethod("previous");
      setEntries(data.entries.map((e) => ({ title: e.title, artist: e.artist, album: e.album, spotifyId: e.spotifyId ?? undefined })));
      setStep(3);
    } catch {
      setStep2Error(t("create.importPrevConnectionError"));
    } finally {
      setImportingPrevious(false);
    }
  };

  const startManual = () => {
    setMethod("manual");
    setEntries([]);
    setStep2Error(null);
    setStep(3);
  };

  const addSong = (song: Song) => {
    if (entries.some((e) => e.title === song.title && e.artist === song.artist)) return;
    setEntries((prev) => [...prev, song]);
  };
  const removeSong = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx));

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
  const clearDrag = () => {
    setDragIndex(null);
    setDragOver(null);
  };

  const renderSongRow = (song: Song, added: boolean, key: string) => {
    const cover = coverForSong(song);
    return (
      <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderRadius: 8 }}>
        <Cover cover={cover} song={song} size={40} rounded={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
        </div>
        <button
          type="button"
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

  const spotlightEntryPayload = (song: Song) => ({
    title: song.title,
    artist: song.artist,
    album: song.album ?? null,
    spotifyId: song.spotifyId ?? null,
    songId: song.id ?? null,
    imageUrl: song.imageUrl ?? null,
  });

  const publishChart = async () => {
    if (!session?.user?.id) {
      setPublishError(t("create.loginRequiredPublish"));
      return;
    }
    if (entries.length === 0) {
      setPublishError(t("create.addOneSong"));
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const publishEntries = userChartSize ? entries.slice(0, userChartSize) : entries;
      const publishBody = JSON.stringify({
        entries: publishEntries.map((e) => ({
          title: e.title,
          artist: e.artist,
          album: e.album,
          spotifyId: e.spotifyId ?? null,
          songId: e.id ?? null,
          imageUrl: e.imageUrl ?? null,
        })),
        weekDate,
        fastPublish: true,
        ...(activeParadaId ? { paradaId: activeParadaId } : {}),
        ...(flashbackSong ? { flashback: spotlightEntryPayload(flashbackSong) } : {}),
        ...(destaqueSong ? { destaque: spotlightEntryPayload(destaqueSong) } : {}),
      });
      const postChart = () =>
        fetch("/api/charts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: publishBody,
        });

      let res: Response;
      try {
        res = await postChart();
      } catch {
        res = await postChart();
      }
      let data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;

      if (res.status === 504 || res.status === 502) {
        res = await postChart();
        data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      }

      if (!res.ok) {
        if (res.status === 401) {
          setPublishError(t("create.sessionExpired"));
          return;
        }
        if (res.status === 409 && data?.id) {
          router.push(`/chart/${data.id}`);
          return;
        }
        if (res.status === 504 || res.status === 502) {
          setPublishError(t("create.publishTimeout"));
          return;
        }
        setPublishError(data?.error ?? t("create.publishError"));
        return;
      }
      if (!data?.id) {
        setPublishError(t("create.publishedNoDetail"));
        return;
      }
      router.push(`/chart/${data.id}`);
    } catch {
      setPublishError(t("create.publishConnectionError"));
    } finally {
      setPublishing(false);
    }
  };

  const cardStyle = (selected: boolean): React.CSSProperties => ({
    border: selected ? "2px solid var(--accent)" : "1px solid var(--divider)",
    background: selected ? "var(--accent-tint, rgba(250,36,60,.08))" : "var(--surface)",
    borderRadius: 16,
    padding: 18,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  });

  return (
    <div style={{ width: "100%", minHeight: "100svh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg-topbar)", borderBottom: "1px solid var(--divider)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent)", display: "grid", placeItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round">
                <line x1="6" y1="20" x2="6" y2="14" />
                <line x1="12" y1="20" x2="12" y2="8" />
                <line x1="18" y1="20" x2="18" y2="4" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.025em" }}>ChartFM</div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : router.push("/"))}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            <ChevronLeft size={16} />
            {step > 1 ? t("createGuided.back") : t("createGuided.cancel")}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: step >= 3 ? 1100 : 640, width: "100%", margin: "0 auto", padding: "36px 20px 96px", boxSizing: "border-box" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>
          {t("createGuided.eyebrow", { step })}
        </div>
        <StepBar step={step} labels={stepLabels} />

        {step === 1 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
              {t("createGuided.step1Title")}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>
              {t("createGuided.step1Subtitle")}
            </div>

            {loadingParadas && <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("createGuided.loadingParadas")}</div>}

            {!loadingParadas && paradas.length === 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("createGuided.noParadaPrompt")}</div>
                <input
                  value={newParadaName}
                  onChange={(e) => setNewParadaName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFirstParada()}
                  placeholder={t("createGuided.newParadaPlaceholder")}
                  maxLength={60}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--fill-subtle)", border: "1px solid var(--divider-strong)", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--text)", outline: "none", marginBottom: 12 }}
                />
                <button
                  type="button"
                  onClick={handleCreateFirstParada}
                  disabled={creatingParada}
                  style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700, cursor: creatingParada ? "not-allowed" : "pointer", opacity: creatingParada ? 0.6 : 1 }}
                >
                  {creatingParada ? t("chart.setup.saving") : t("createGuided.createParadaButton")}
                </button>
              </div>
            )}

            {!loadingParadas && paradas.length > 0 && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {paradas.map((p) => (
                    <button key={p.id} type="button" onClick={() => setActiveParadaId(p.id)} style={cardStyle(activeParadaId === p.id)}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {p.cadence === "daily" ? t("createGuided.dailyParada") : t("createGuided.weeklyParada")}
                            {p.chartSize ? ` · ${t("createGuided.songsCapSuffix", { count: p.chartSize })}` : ""}
                            {p.isPrimary ? ` · ${t("createGuided.primaryTag")}` : ""}
                          </div>
                        </div>
                        {activeParadaId === p.id && (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Check size={13} color="#fff" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {activeParadaId && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                      {activeParadaCadence === "daily" ? t("createGuided.dayLabel") : t("createGuided.weekLabel")}
                    </div>
                    <WeekCalendar value={weekDate} onChange={setWeekDate} paradaId={activeParadaId} mode={activeParadaCadence} />
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>{periodoLabel}</div>
                  </div>
                )}

                {step1Error && <div style={{ color: "#B91C1C", fontSize: 13, marginTop: 12 }}>{step1Error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
                  <button
                    type="button"
                    onClick={goStep2}
                    disabled={!activeParadaId}
                    style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "14px 32px", borderRadius: 100, fontSize: 15, fontWeight: 700, cursor: !activeParadaId ? "not-allowed" : "pointer", opacity: !activeParadaId ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {t("createGuided.continueButton")} <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{t("createGuided.step2Title")}</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5, maxWidth: 520 }}>
              {t("createGuided.step2Subtitle")}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button type="button" onClick={importFromLastfm} disabled={importingLastfm || !userLastfmUser} style={{ ...cardStyle(false), opacity: !userLastfmUser ? 0.6 : 1, cursor: !userLastfmUser ? "default" : "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D51007", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>▲</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{importingLastfm ? t("create.importingLastfm") : t("createGuided.lastfmCardTitle")}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
                      {userLastfmUser
                        ? t("createGuided.lastfmCardDescConnected")
                        : (
                          <>
                            {t("createGuided.lastfmCardDescPrefix")}{" "}
                            <a href="/settings" onClick={(e) => e.stopPropagation()} style={{ color: "#FA243C", fontWeight: 600 }}>{t("createGuided.settingsLink")}</a>{" "}
                            {t("createGuided.lastfmCardDescSuffix")}
                          </>
                        )}
                    </div>
                  </div>
                </div>
              </button>

              <button type="button" onClick={startManual} style={cardStyle(false)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--fill-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✎</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{t("createGuided.manualCardTitle")}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
                      {t("createGuided.manualCardDesc")}
                    </div>
                  </div>
                </div>
              </button>

              <button type="button" onClick={importPrevious} disabled={importingPrevious} style={cardStyle(false)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--fill-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>↺</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{importingPrevious ? t("create.importing") : t("createGuided.previousCardTitle")}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
                      {activeParadaCadence === "daily" ? t("createGuided.previousCardDescDaily") : t("createGuided.previousCardDescWeekly")}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {step2Error && <div style={{ color: "#B91C1C", fontSize: 13, marginTop: 16 }}>{step2Error}</div>}

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, background: "var(--fill-subtle)", borderRadius: 12, padding: "14px 20px" }}>
              {t("createGuided.step2FooterNote")}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 380px", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{t("createGuided.step3Title")}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
                {entries.length === 0 ? t("create.noSongsYet") : entries.length === 1 ? t("create.songCountOne", { count: entries.length }) : t("create.songCount", { count: entries.length })}
                {" · "}{t("createGuided.dragHint")}
              </div>

              <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
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
                  const isBeyondCut = userChartSize !== null && i >= userChartSize;
                  return (
                    <div key={`${song.title}-${song.artist}-${i}`}>
                      {userChartSize !== null && i === userChartSize && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: "rgba(250,36,60,0.04)" }}>
                          <div style={{ flex: 1, height: 1, background: "rgba(250,36,60,0.25)" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#FA243C", whiteSpace: "nowrap" }}>{t("create.cutoffLabel", { position: userChartSize })}</span>
                          <div style={{ flex: 1, height: 1, background: "rgba(250,36,60,0.25)" }} />
                        </div>
                      )}
                      {!isMobile ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDrop={() => handleDrop(i)}
                          onDragEnd={clearDrag}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "32px 40px 56px 1fr 36px",
                            alignItems: "center",
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--divider-soft)",
                            background: dragOver === i ? "var(--accent-tint)" : isBeyondCut ? "var(--fill-inset)" : "var(--surface)",
                            cursor: "grab",
                            opacity: isBeyondCut ? 0.45 : 1,
                          }}
                        >
                          <div style={{ color: "var(--text-disabled)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <GripVertical size={16} />
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 6 }}>{i + 1}</div>
                          <div style={{ padding: "0 6px" }}>
                            <Cover cover={cover} song={song} size={44} rounded={8} />
                          </div>
                          <div style={{ minWidth: 0, padding: "0 6px" }}>
                            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
                          </div>
                          <button type="button" onClick={() => removeSong(i)} style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <MobileReorderListRow
                          position={i + 1}
                          cover={<Cover cover={cover} song={song} size={36} rounded={8} />}
                          title={song.title}
                          artist={song.artist}
                          mode={mobileReorder.mode}
                          rowProps={mobileReorder.getRowProps(i)}
                          onRemove={() => removeSong(i)}
                          opacity={isBeyondCut ? 0.45 : 1}
                          rowStyleOverride={isBeyondCut ? { background: "var(--fill-inset)" } : undefined}
                        />
                      )}
                    </div>
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
                {entries.length === 0 && (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                    {t("create.addFromSearch")}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={entries.length === 0}
                  style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "14px 32px", borderRadius: 100, fontSize: 15, fontWeight: 700, cursor: entries.length === 0 ? "not-allowed" : "pointer", opacity: entries.length === 0 ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
                >
                  {t("createGuided.continueButton")} <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t("create.searchSongTitle")}</div>
                <button
                  type="button"
                  onClick={() => setShowManualCreate(true)}
                  title={t("create.manualCreateTooltip")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--divider-strong)", background: "var(--fill-subtle)", color: "var(--text)", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                >
                  <Plus size={12} /> {t("create.manualCreateButton")}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{t("chart.edit.catalogLabel")}</div>
                <input
                  value={dbQuery}
                  onChange={(e) => setDbQuery(e.target.value)}
                  placeholder={t("create.searchLocal")}
                  style={{ width: "100%", border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", background: "var(--fill-subtle)", marginBottom: 10, boxSizing: "border-box" }}
                />
                {dbQuery.trim().length >= 2 ? (
                  <>
                    {dbLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.searching")}</div>}
                    {!dbLoading &&
                      (dbSongs.length > 0
                        ? dbSongs.map((song) => renderSongRow(song, entries.some((e) => e.title === song.title && e.artist === song.artist), `db-${song.id ?? song.title}-${song.artist}`))
                        : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("create.noCatalogSongs")}</div>)}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("createGuided.typeToSearchCatalog")}</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{t("chart.edit.spotifyLabel")}</div>
                <input
                  value={spotifyQuery}
                  onChange={(e) => setSpotifyQuery(e.target.value)}
                  placeholder={t("chart.edit.spotifySearchPlaceholder")}
                  style={{ width: "100%", border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", background: "var(--fill-subtle)", marginBottom: 10, boxSizing: "border-box" }}
                />
                {spotifyQuery.trim().length < 1 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.typeToSearchSpotify")}</div>
                ) : (
                  <>
                    {spotifyLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.searching")}</div>}
                    {!spotifyLoading && !spotifyConfigured && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("createGuided.spotifyNotConfigured")}</div>}
                    {!spotifyLoading && spotifyConfigured && spotifyUnavailable && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.spotifyUnavailable")}</div>}
                    {!spotifyLoading && spotifyConfigured && !spotifyUnavailable && spotifyTracks.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.noSpotifyResults")}</div>}
                    {!spotifyLoading &&
                      spotifyTracks.map((song, i) => renderSongRow(song, entries.some((e) => e.title === song.title && e.artist === song.artist), `sp-${song.spotifyId ?? i}`))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{t("createGuided.step4Title")}</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>
              {t("createGuided.step4Subtitle")}
            </div>

            <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>{t("createGuided.summaryLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{activeParada?.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {periodoLabel} · {entries.length === 1 ? t("create.songCountOne", { count: entries.length }) : t("create.songCount", { count: entries.length })}
              </div>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t("create.extrasTitle")}</div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 14px" }}>
                {t("create.extrasDesc")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <SpotlightSearchCard label={t("create.flashbackLabel")} accentColor="#7C3AED" category="flashback" song={flashbackSong} onSelect={setFlashbackSong} onClear={() => setFlashbackSong(null)} />
                <SpotlightSearchCard label={t("create.destaqueLabel")} accentColor="var(--accent)" category="destaque" song={destaqueSong} onSelect={setDestaqueSong} onClear={() => setDestaqueSong(null)} />
              </div>
            </div>

            {publishError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 16 }}>{publishError}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={publishChart}
                disabled={publishing || entries.length === 0}
                style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "15px 36px", borderRadius: 100, fontSize: 15, fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer", opacity: publishing ? 0.7 : 1 }}
              >
                {publishing ? t("create.publishing") : t("create.publishChart")}
              </button>
            </div>
          </div>
        )}
      </div>

      {showManualCreate && (
        <ManualSongCreateModal
          onClose={() => setShowManualCreate(false)}
          onCreated={(song) => {
            addSong(song);
            setShowManualCreate(false);
          }}
        />
      )}
    </div>
  );
}
