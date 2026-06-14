"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Music2, RefreshCw, Link2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { brtWeekday, type MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { MyTrlVideoClipList } from "@/components/mytrl/MyTrlVideoClipList";

type SnapshotPayload = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
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
  computedAt: string;
};

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
  const [generateDate, setGenerateDate] = useState("");
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

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

  const navBtnStyle = (enabled: boolean) => ({
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--divider)",
    background: "var(--surface)",
    color: enabled ? "var(--text)" : "var(--text-disabled)",
    cursor: enabled ? "pointer" as const : "default" as const,
    opacity: enabled ? 1 : 0.45,
    flexShrink: 0,
  });

  const prevEdition = canGoPrev ? timeline[timelineIndex - 1] : null;
  const nextEdition = canGoNext ? timeline[timelineIndex + 1] : null;

  return (
    <Shell title="MyTRL" subtitle="Parada diária · top 10 new hits · seg–sex às 18h">
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {banner && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--accent-tint)", color: "var(--text)", fontSize: 14 }}>
            {banner}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          {!spotify?.connected ? (
            <a
              href="/api/spotify/auth"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                background: "#1DB954",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <Link2 size={16} />
              Conectar Spotify
            </a>
          ) : !spotify.playlistFound ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
              <AlertCircle size={16} />
              Crie a playlist &quot;new hits&quot; no Spotify
            </span>
          ) : null}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Data:</span>
            <input
              type="date"
              value={generateDate}
              onChange={(e) => setGenerateDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--divider)",
              background: "var(--surface)",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 13,
              cursor: generating ? "wait" : "pointer",
              opacity: generating ? 0.7 : 1,
            }}
          >
            <RefreshCw size={16} />
            {generateDate ? "Gerar para data" : "Gerar agora"}
          </button>
        </div>

        {timeline.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 44px",
              gap: 12,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev || loading}
              aria-label={prevEdition ? `Edição anterior: ${prevEdition.dateRange}` : "Sem edição anterior"}
              style={navBtnStyle(canGoPrev && !loading)}
            >
              <ChevronLeft size={22} />
            </button>

            <div style={{ minWidth: 0, textAlign: "center" }}>
              {snapshot && currentEdition ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    <Music2 size={20} color="var(--accent)" />
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{snapshot.dateRange}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    {snapshot.weekLabel}
                    {snapshot.scoringWindow && <> · Janela: {snapshot.scoringWindow}</>}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-disabled)" }}>
                    {timelineIndex + 1} de {timeline.length}
                    {" · "}
                    Atualizado{" "}
                    {new Date(snapshot.computedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </div>
                </>
              ) : !loading ? (
                <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                  Nenhuma parada nesta posição.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext || loading}
              aria-label={nextEdition ? `Próxima edição: ${nextEdition.dateRange}` : "Sem próxima edição"}
              style={navBtnStyle(canGoNext && !loading)}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        )}

        {timeline.length === 0 && !loading && (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
            Nenhuma parada ainda. Conecte o Spotify e gere a primeira edição.
          </p>
        )}

        {(prevEdition || nextEdition) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "0 4px",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%" }}>
              {prevEdition ? `← ${prevEdition.dateRange}` : ""}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%", textAlign: "right" }}>
              {nextEdition ? `${nextEdition.dateRange} →` : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>
        ) : snapshot ? (
          <MyTrlVideoClipList entries={snapshot.entries} videoClips={videoClips} />
        ) : null}

        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, textAlign: "center" }}>
          Use as setas ou o teclado (← →) para navegar entre as edições diárias.
          Movimentação e &quot;Dias&quot; comparam com a parada do dia anterior.
        </p>
      </div>
    </Shell>
  );
}
