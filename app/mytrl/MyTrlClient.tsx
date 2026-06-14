"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Music2, RefreshCw, Link2, AlertCircle, LayoutGrid, CalendarRange } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { MYTRL_WEEKDAYS, type MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { MyTrlVideoClipList } from "@/components/mytrl/MyTrlVideoClipList";
import { MyTrlWeekView, type MyTrlWeekDay } from "@/components/mytrl/MyTrlWeekView";

type ViewMode = "week" | "day";

type SnapshotPayload = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  computedAt: string;
  entries: MyTrlChartEntry[];
};

type HistoryRow = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  computedAt: string;
};

type WeekMeta = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string | null;
};

type SpotifyStatus = {
  configured: boolean;
  connected: boolean;
  playlistFound: boolean;
  playlistId: string | null;
};

export default function MyTrlClient() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekday, setWeekday] = useState(1);
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [weekdayLabel, setWeekdayLabel] = useState("Segunda");
  const [videoClips, setVideoClips] = useState<Record<string, string>>({});
  const [weekDays, setWeekDays] = useState<MyTrlWeekDay[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [availableWeeks, setAvailableWeeks] = useState<WeekMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateDate, setGenerateDate] = useState("");
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const loadDay = useCallback(async (wd: number, wi: number | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ weekday: String(wd) });
      if (wi != null) qs.set("weekIndex", String(wi));
      const res = await fetch(`/api/mytrl?${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSnapshot(data.snapshot);
      setHistory(data.history ?? []);
      setWeekdayLabel(data.weekdayLabel ?? "");
      setVideoClips(data.videoClips ?? {});
      if (!wi && data.snapshot?.weekIndex) setWeekIndex(data.snapshot.weekIndex);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(async (wi: number | null) => {
    setLoading(true);
    try {
      const qs = wi != null ? `?weekIndex=${wi}` : "";
      const res = await fetch(`/api/mytrl/week${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setWeekDays(data.days ?? []);
      setWeekLabel(data.weekLabel ?? "");
      setVideoClips(data.videoClips ?? {});
      setAvailableWeeks(data.availableWeeks ?? []);
      if (data.weekIndex != null) setWeekIndex(data.weekIndex);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpotify = useCallback(async () => {
    const res = await fetch("/api/spotify/status", { cache: "no-store" });
    if (res.ok) setSpotify(await res.json());
  }, []);

  useEffect(() => {
    void loadSpotify();
  }, [loadSpotify]);

  useEffect(() => {
    const spotifyParam = searchParams.get("spotify");
    if (spotifyParam === "connected") setBanner("Spotify conectado com sucesso!");
    else if (spotifyParam === "connected_no_playlist") setBanner("Spotify conectado, mas a playlist \"new hits\" não foi encontrada.");
    else if (spotifyParam === "error") setBanner("Erro ao conectar Spotify.");
    else if (spotifyParam === "invalid_state") setBanner("Sessão OAuth inválida. Tente novamente.");
    else if (spotifyParam === "token_error") setBanner("Não foi possível obter token do Spotify.");
  }, [searchParams]);

  useEffect(() => {
    if (viewMode === "week") void loadWeek(weekIndex);
    else void loadDay(weekday, weekIndex);
  }, [viewMode, weekday, weekIndex, loadDay, loadWeek]);

  const handleWeekdayChange = (wd: number) => {
    setWeekday(wd);
    setWeekIndex(null);
    setViewMode("day");
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
        if (data.weekIndex != null) setWeekIndex(data.weekIndex);
        if (viewMode === "week") await loadWeek(data.weekIndex ?? weekIndex);
        else {
          if (data.weekday) setWeekday(data.weekday);
          await loadDay(data.weekday ?? weekday, data.weekIndex ?? weekIndex);
        }
      } else {
        setBanner(data.error ?? "Erro ao gerar parada.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const viewToggleStyle = (active: boolean) => ({
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: 6,
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid var(--divider)",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--text)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer" as const,
  });

  return (
    <Shell title="MyTRL" subtitle="Top 10 new hits · vídeo clipe · seg–sex 18h">
      <div
        style={{
          maxWidth: viewMode === "week" ? 1440 : 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          transition: "max-width 0.2s ease",
        }}
      >
        {banner && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--accent-tint)", color: "var(--text)", fontSize: 14 }}>
            {banner}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setViewMode("week")} style={viewToggleStyle(viewMode === "week")}>
              <CalendarRange size={16} />
              Semana
            </button>
            <button type="button" onClick={() => setViewMode("day")} style={viewToggleStyle(viewMode === "day")}>
              <LayoutGrid size={16} />
              Dia
            </button>
            {viewMode === "day" &&
              MYTRL_WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => handleWeekdayChange(d.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid var(--divider)",
                    background: weekday === d.value ? "var(--text)" : "var(--surface)",
                    color: weekday === d.value ? "var(--surface)" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        </div>

        {viewMode === "week" && availableWeeks.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Semanas:</span>
            {availableWeeks.map((w) => (
              <button
                key={w.weekIndex}
                type="button"
                onClick={() => setWeekIndex(w.weekIndex)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  background: weekIndex === w.weekIndex ? "var(--accent-tint)" : "transparent",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                {w.dateRange ?? w.weekLabel}
              </button>
            ))}
          </div>
        )}

        {viewMode === "day" && snapshot && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Music2 size={20} color="var(--accent)" />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{weekdayLabel}</span>
            </div>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{snapshot.weekLabel}</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>· {snapshot.dateRange}</span>
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>
              Atualizado {new Date(snapshot.computedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
        )}

        {viewMode === "day" && !snapshot && !loading && (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Nenhuma edição de {weekdayLabel.toLowerCase()} ainda. Conecte o Spotify e gere a primeira parada.
          </p>
        )}

        {viewMode === "day" && history.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Edições:</span>
            {history.map((h) => (
              <button
                key={h.weekIndex}
                type="button"
                onClick={() => setWeekIndex(h.weekIndex)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  background: snapshot?.weekIndex === h.weekIndex ? "var(--accent-tint)" : "transparent",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                {h.dateRange}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>
        ) : viewMode === "week" ? (
          <MyTrlWeekView
            weekLabel={weekLabel}
            days={weekDays}
            videoClips={videoClips}
            onSelectDay={(wd) => {
              setWeekday(wd);
              setViewMode("day");
            }}
          />
        ) : (
          <MyTrlVideoClipList entries={snapshot?.entries ?? []} videoClips={videoClips} />
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Visualização em <strong>vídeo clipe</strong> (capturas da comunidade ou sua escolha por música).
          Pesos Last.fm (7 dias): ontem ×20 até −7 ×10. Só entram faixas da playlist <strong>new hits</strong>.
        </p>
      </div>
    </Shell>
  );
}
