"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Link2, AlertCircle, ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { brtWeekday, formatMyTrlEditionDisplay, type MyTrlChartEntry, type MyTrlEditionDisplay } from "@/lib/mytrl-chart-engine";
import { MyTrlVideoClipList } from "@/components/mytrl/MyTrlVideoClipList";
import { MyTrlCalendar } from "@/components/mytrl/MyTrlCalendar";

type SnapshotPayload = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  edition?: MyTrlEditionDisplay;
  scoringWindow?: string;
  computedAt: string;
  entries: MyTrlChartEntry[];
};

type TimelineEntry = {
  weekday: number;
  weekIndex: number;
  weekdayLabel: string;
  weekLabel: string;
  dateRange: string;
  edition?: MyTrlEditionDisplay;
  computedAt: string;
};

function editionFromEntry(entry: { edition?: MyTrlEditionDisplay; computedAt: string; weekdayLabel?: string }): MyTrlEditionDisplay {
  if (entry.edition) return entry.edition;
  return formatMyTrlEditionDisplay(new Date(entry.computedAt));
}

type SpotifyStatus = {
  configured: boolean;
  connected: boolean;
  playlistFound: boolean;
  playlistId: string | null;
};

function editionKey(entry: Pick<TimelineEntry, "weekday" | "weekIndex">) {
  return `${entry.weekday}:${entry.weekIndex}`;
}

export default function MyTrlClient() {
  const searchParams = useSearchParams();
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(-1);
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [videoClips, setVideoClips] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [generateDate, setGenerateDate] = useState("");
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const currentEdition = timelineIndex >= 0 ? timeline[timelineIndex] ?? null : null;
  const canGoPrev = timelineIndex > 0;
  const canGoNext = timelineIndex >= 0 && timelineIndex < timeline.length - 1;

  const loadEdition = useCallback(async (entry: TimelineEntry) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        weekday: String(entry.weekday),
        weekIndex: String(entry.weekIndex),
      });
      const res = await fetch(`/api/mytrl?${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSnapshot(data.snapshot);
      setVideoClips(data.videoClips ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (preferLatest = true) => {
    setLoading(true);
    try {
      const res = await fetch("/api/mytrl/timeline", { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      const editions = (data.editions ?? []) as TimelineEntry[];
      setTimeline(editions);

      if (editions.length === 0) {
        setTimelineIndex(-1);
        setSnapshot(null);
        setVideoClips({});
        return editions;
      }

      let index = editions.length - 1;
      if (preferLatest) {
        const todayWd = brtWeekday();
        if (todayWd > 0) {
          const todayIdx = editions.findLastIndex(
            (e) => e.weekday === todayWd && e.weekIndex === editions[editions.length - 1]?.weekIndex,
          );
          if (todayIdx >= 0) index = todayIdx;
        }
      }

      setTimelineIndex(index);
      await loadEdition(editions[index]);
      return editions;
    } finally {
      setLoading(false);
    }
  }, [loadEdition]);

  const loadSpotify = useCallback(async () => {
    const res = await fetch("/api/spotify/status", { cache: "no-store" });
    if (res.ok) setSpotify(await res.json());
  }, []);

  useEffect(() => {
    void loadSpotify();
    void loadTimeline();
  }, [loadSpotify, loadTimeline]);

  useEffect(() => {
    const spotifyParam = searchParams.get("spotify");
    if (spotifyParam === "connected") setBanner("Spotify conectado com sucesso!");
    else if (spotifyParam === "connected_no_playlist") setBanner("Spotify conectado, mas a playlist \"new hits\" não foi encontrada.");
    else if (spotifyParam === "error") setBanner("Erro ao conectar Spotify.");
    else if (spotifyParam === "invalid_state") setBanner("Sessão OAuth inválida. Tente novamente.");
    else if (spotifyParam === "token_error") setBanner("Não foi possível obter token do Spotify.");
  }, [searchParams]);

  const goToIndex = useCallback(
    (index: number) => {
      const entry = timeline[index];
      if (!entry) return;
      setTimelineIndex(index);
      void loadEdition(entry);
    },
    [timeline, loadEdition],
  );

  const goPrev = useCallback(() => {
    if (timelineIndex <= 0) return;
    goToIndex(timelineIndex - 1);
  }, [timelineIndex, goToIndex]);

  const goNext = useCallback(() => {
    if (timelineIndex < 0 || timelineIndex >= timeline.length - 1) return;
    goToIndex(timelineIndex + 1);
  }, [timelineIndex, timeline.length, goToIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        if (timelineIndex <= 0) return;
        e.preventDefault();
        goToIndex(timelineIndex - 1);
      } else if (e.key === "ArrowRight") {
        if (timelineIndex < 0 || timelineIndex >= timeline.length - 1) return;
        e.preventDefault();
        goToIndex(timelineIndex + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [timelineIndex, timeline.length, goToIndex]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const res = await fetch("/api/mytrl/recompute", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setBanner(`Estatísticas recalculadas (${data.editions} edições).`);
        await loadTimeline(false);
        if (timelineIndex >= 0 && timeline[timelineIndex]) {
          await loadEdition(timeline[timelineIndex]);
        }
      } else {
        setBanner(data.error ?? "Erro ao recalcular estatísticas.");
      }
    } finally {
      setRecomputing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = generateDate.trim() ? { date: generateDate.trim() } : undefined;
      const res = await fetch("/api/mytrl/generate", {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.ok) {
        setBanner(`Parada gerada (${data.referenceDate}): ${data.count} faixas · ${data.dateRange}.`);
        const editions = await loadTimeline(false);
        const key = `${data.weekday}:${data.weekIndex}`;
        const idx = editions.findIndex((e) => editionKey(e) === key);
        if (idx >= 0) goToIndex(idx);
      } else {
        setBanner(data.error ?? "Erro ao gerar parada.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--divider)",
    background: "var(--fill-inset)",
    color: enabled ? "var(--text)" : "var(--text-disabled)",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.4,
    flexShrink: 0,
  });

  const prevEdition = canGoPrev ? timeline[timelineIndex - 1] : null;
  const nextEdition = canGoNext ? timeline[timelineIndex + 1] : null;
  const editionDisplay = snapshot ? editionFromEntry(snapshot) : null;

  return (
    <Shell title="MyTRL" subtitle="Parada diária · top 10 new hits · seg–sex às 18h">
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Banner */}
        {banner && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: "var(--accent-tint)", color: "var(--text)", fontSize: 14 }}>
            <span style={{ flex: 1 }}>{banner}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex", alignItems: "center" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── EMPTY STATE ─────────────────────────────────────────── */}
        {timeline.length === 0 && !loading && (
          <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "56px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🎵</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Nenhuma parada ainda</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
              Conecte o Spotify e gere a primeira edição para começar.
            </div>
            <button
              type="button"
              onClick={() => setShowAdmin(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 100, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Settings2 size={15} />
              Abrir ferramentas
            </button>
          </div>
        )}

        {/* ── CHART CARD ──────────────────────────────────────────── */}
        {timeline.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

            {/* Nav header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--divider)" }}>
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev || loading}
                aria-label={prevEdition ? `Edição anterior: ${editionFromEntry(prevEdition).shortLabel}` : "Sem edição anterior"}
                style={navBtnStyle(canGoPrev && !loading)}
              >
                <ChevronLeft size={18} />
              </button>

              <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                {editionDisplay ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 3 }}>
                      {editionDisplay.weekdayLabel}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1.15 }}>
                      {editionDisplay.dayOfMonth} de {editionDisplay.monthLabel} de {editionDisplay.year}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {snapshot?.weekLabel}
                      {snapshot?.scoringWindow && <> · Last.fm: {snapshot.scoringWindow}</>}
                      {" · "}<span style={{ fontVariantNumeric: "tabular-nums" }}>{timelineIndex + 1} de {timeline.length}</span>
                    </div>
                  </>
                ) : loading ? (
                  <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Carregando…</div>
                ) : (
                  <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Sem edição</div>
                )}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext || loading}
                aria-label={nextEdition ? `Próxima edição: ${editionFromEntry(nextEdition).shortLabel}` : "Sem próxima edição"}
                style={navBtnStyle(canGoNext && !loading)}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Prev / next labels */}
            {(prevEdition || nextEdition) && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", padding: "5px 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
                <span>{prevEdition ? `← ${editionFromEntry(prevEdition).shortLabel}` : ""}</span>
                <span style={{ color: "var(--text-disabled)", fontSize: 10 }}>← → teclado</span>
                <span>{nextEdition ? `${editionFromEntry(nextEdition).shortLabel} →` : ""}</span>
              </div>
            )}

            {/* Calendar */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--divider)" }}>
              <MyTrlCalendar
                timeline={timeline}
                currentIndex={timelineIndex}
                onSelect={goToIndex}
              />
            </div>

            {/* Chart entries */}
            {loading ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                Carregando…
              </div>
            ) : snapshot ? (
              <MyTrlVideoClipList entries={snapshot.entries} videoClips={videoClips} />
            ) : (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                Nenhuma parada nesta posição.
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN TOOLS — collapsible, visually de-emphasized ───── */}
        <div style={{ borderRadius: 14, border: "1px solid var(--divider)", overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setShowAdmin((s) => !s)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 16px",
              background: "var(--fill-inset)",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <Settings2 size={15} />
            Ferramentas
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ marginLeft: "auto", transform: showAdmin ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showAdmin && (
            <div style={{ padding: "16px", borderTop: "1px solid var(--divider)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {/* Spotify status */}
              {!spotify?.connected ? (
                <a
                  href="/api/spotify/auth"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "#1DB954", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                >
                  <Link2 size={15} />
                  Conectar Spotify
                </a>
              ) : !spotify.playlistFound ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                  <AlertCircle size={15} />
                  Crie a playlist &quot;new hits&quot; no Spotify
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#1DB954", fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Spotify conectado
                </span>
              )}

              {/* Date input */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Data:</span>
                <input
                  type="date"
                  value={generateDate}
                  onChange={(e) => setGenerateDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
                />
              </label>

              {/* Recompute */}
              <button
                type="button"
                onClick={() => void handleRecompute()}
                disabled={recomputing || timeline.length === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--divider)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: recomputing ? "wait" : "pointer", opacity: recomputing || timeline.length === 0 ? 0.6 : 1, fontFamily: "inherit" }}
              >
                <RefreshCw size={14} />
                Recalcular stats
              </button>

              {/* Generate */}
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--divider)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1, fontFamily: "inherit" }}
              >
                <RefreshCw size={14} />
                {generateDate ? "Gerar para data" : "Gerar agora"}
              </button>
            </div>
          )}
        </div>

      </div>
    </Shell>
  );
}
