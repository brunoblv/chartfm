"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Save, RotateCcw, ExternalLink, Film } from "lucide-react";
import {
  adminCompactTdStyle,
  adminCompactThStyle,
  adminInputStyle,
  adminPageWrapStyle,
  adminPanelStyle,
} from "@/components/admin/admin-styles";
import {
  VIDEOPARADA_PLATFORMS,
  VIDEOPARADA_SHORTS_SECONDS,
  VIDEOPARADA_YOUTUBE_SECONDS,
  type VideoparadaChartOption,
  type VideoparadaEntryRow,
  type VideoparadaWeekOption,
} from "@/lib/videoparada-shared";

type DraftConfig = {
  videoUrl: string;
  platform: string;
  startSeconds: string;
  endSeconds: string;
  useAutoChorus: boolean;
  forceDebut: boolean;
  skipAutoVideo: boolean;
  notes: string;
};

type ApiPayload = {
  charts: VideoparadaChartOption[];
  weeks: VideoparadaWeekOption[];
  chartKind: string;
  chartLabel?: string;
  weekIndex: number | null;
  weekLabel?: string | null;
  dateRange?: string | null;
  entries: VideoparadaEntryRow[];
  defaults?: { shortsSeconds: number; youtubeSeconds: number };
  message?: string;
  error?: string;
};

function entryToDraft(e: VideoparadaEntryRow): DraftConfig {
  return {
    videoUrl: e.config.videoUrl ?? "",
    platform: e.config.platform ?? "",
    startSeconds: e.config.startSeconds != null ? String(e.config.startSeconds) : "",
    endSeconds: e.config.endSeconds != null ? String(e.config.endSeconds) : "",
    useAutoChorus: e.config.useAutoChorus,
    forceDebut: e.config.forceDebut,
    skipAutoVideo: e.config.skipAutoVideo,
    notes: e.config.notes ?? "",
  };
}

function draftsEqual(a: DraftConfig, b: DraftConfig): boolean {
  return (
    a.videoUrl === b.videoUrl &&
    a.platform === b.platform &&
    a.startSeconds === b.startSeconds &&
    a.endSeconds === b.endSeconds &&
    a.useAutoChorus === b.useAutoChorus &&
    a.forceDebut === b.forceDebut &&
    a.skipAutoVideo === b.skipAutoVideo &&
    a.notes === b.notes
  );
}

const chipBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtn: CSSProperties = {
  ...chipBtn,
  background: "#FA243C",
  borderColor: "#FA243C",
  color: "#fff",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const compactInput: CSSProperties = {
  ...adminInputStyle,
  padding: "7px 9px",
  fontSize: 13,
  borderRadius: 8,
};

function StatusBadge({ status, forceDebut }: { status: string; forceDebut: boolean }) {
  const isNew = forceDebut || status === "new";
  if (!isNew && status !== "return") {
    return (
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
        {status === "up" ? "↑" : status === "down" ? "↓" : "—"}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
        background: isNew ? "#FA243C" : "var(--surface-2, #eee)",
        color: isNew ? "#fff" : "var(--text)",
      }}
    >
      {isNew ? "NEW" : "RET"}
      {forceDebut && status !== "new" ? "*" : ""}
    </span>
  );
}

export default function VideoparadaAdminClient({
  initialCharts,
  initialChartKind,
  initialWeeks,
  initialWeekIndex,
}: {
  initialCharts: VideoparadaChartOption[];
  initialChartKind: string;
  initialWeeks: VideoparadaWeekOption[];
  initialWeekIndex: number | null;
}) {
  const [charts, setCharts] = useState(initialCharts);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [chartKind, setChartKind] = useState(initialChartKind);
  const [weekIndex, setWeekIndex] = useState<number | null>(initialWeekIndex);
  const [weekLabel, setWeekLabel] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string | null>(null);
  const [chartLabel, setChartLabel] = useState("Top 100 Global");
  const [entries, setEntries] = useState<VideoparadaEntryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftConfig>>({});
  const [baseline, setBaseline] = useState<Record<string, DraftConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "configured" | "missing">("all");
  const [query, setQuery] = useState("");

  const applyPayload = useCallback((json: ApiPayload) => {
    setCharts(json.charts);
    setWeeks(json.weeks);
    setChartKind(json.chartKind);
    setWeekIndex(json.weekIndex);
    setWeekLabel(json.weekLabel ?? null);
    setDateRange(json.dateRange ?? null);
    setChartLabel(json.chartLabel ?? json.chartKind);
    setEntries(json.entries ?? []);
    const next: Record<string, DraftConfig> = {};
    for (const e of json.entries ?? []) {
      next[e.songId] = entryToDraft(e);
    }
    setDrafts(next);
    setBaseline(structuredClone(next));
    if (json.error) setError(json.error);
    else if (json.message) setMessage(json.message);
  }, []);

  const load = useCallback(
    async (kind: string, week: number | null) => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const params = new URLSearchParams({ chartKind: kind });
        if (week != null) params.set("weekIndex", String(week));
        const res = await fetch(`/api/admin/videoparada?${params}`);
        const json = (await res.json()) as ApiPayload;
        if (!res.ok && !json.entries) {
          throw new Error(json.error || "Falha ao carregar");
        }
        applyPayload(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar");
      } finally {
        setLoading(false);
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    void load(initialChartKind, initialWeekIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial única
  }, []);

  const dirtySongIds = useMemo(() => {
    return Object.keys(drafts).filter((id) => {
      const d = drafts[id];
      const b = baseline[id];
      if (!d || !b) return false;
      return !draftsEqual(d, b);
    });
  }, [drafts, baseline]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const d = drafts[e.songId];
      if (filter === "new" && e.status !== "new" && !d?.forceDebut) return false;
      if (filter === "configured") {
        const configured =
          Boolean(d?.videoUrl?.trim()) ||
          d?.forceDebut ||
          d?.skipAutoVideo ||
          !d?.useAutoChorus ||
          Boolean(d?.notes?.trim()) ||
          Boolean(d?.startSeconds) ||
          Boolean(d?.endSeconds);
        if (!configured) return false;
      }
      if (filter === "missing") {
        const hasUrl = Boolean(d?.videoUrl?.trim()) || Boolean(e.suggestedYoutubeId);
        if (hasUrl && !d?.skipAutoVideo) return false;
      }
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.artist.toLowerCase().includes(q) ||
        String(e.position).includes(q)
      );
    });
  }, [entries, drafts, filter, query]);

  function updateDraft(songId: string, patch: Partial<DraftConfig>) {
    setDrafts((prev) => ({
      ...prev,
      [songId]: { ...prev[songId], ...patch },
    }));
  }

  function applySuggestedUrl(songId: string, youtubeId: string | null) {
    if (!youtubeId) return;
    updateDraft(songId, {
      videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      platform: "youtube",
    });
  }

  function applyDefaultDuration(songId: string, seconds: number) {
    const d = drafts[songId];
    const start = d?.startSeconds !== "" && d?.startSeconds != null ? Number(d.startSeconds) : 0;
    const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
    updateDraft(songId, {
      useAutoChorus: false,
      startSeconds: String(safeStart),
      endSeconds: String(Math.round((safeStart + seconds) * 100) / 100),
    });
  }

  async function saveDirty() {
    if (weekIndex == null || dirtySongIds.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payloadEntries = dirtySongIds.map((songId) => {
        const e = entries.find((x) => x.songId === songId)!;
        const d = drafts[songId];
        return {
          songId,
          position: e.position,
          videoUrl: d.videoUrl.trim() || null,
          platform: d.platform || null,
          startSeconds: d.startSeconds === "" ? null : Number(d.startSeconds),
          endSeconds: d.endSeconds === "" ? null : Number(d.endSeconds),
          useAutoChorus: d.useAutoChorus,
          forceDebut: d.forceDebut,
          skipAutoVideo: d.skipAutoVideo,
          notes: d.notes.trim() || null,
        };
      });

      const res = await fetch("/api/admin/videoparada", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartKind, weekIndex, entries: payloadEntries }),
      });
      const json = (await res.json()) as ApiPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao salvar");
      applyPayload(json);
      setMessage(`Salvo: ${dirtySongIds.length} música(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function resetDirty() {
    setDrafts(structuredClone(baseline));
    setMessage(null);
    setError(null);
  }

  return (
    <div style={adminPageWrapStyle}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 720 }}>
          Configure o clipe de cada posição da parada oficial. URL e trecho manuais têm prioridade sobre a
          detecção automática. Padrão: {VIDEOPARADA_SHORTS_SECONDS}s (Shorts) · {VIDEOPARADA_YOUTUBE_SECONDS}s
          (YouTube completo).
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginBottom: 12 }}>
          <div style={{ minWidth: 200 }}>
            <label style={labelStyle}>Parada</label>
            <select
              value={chartKind}
              onChange={(ev) => {
                const kind = ev.target.value;
                setChartKind(kind);
                void load(kind, null);
              }}
              style={compactInput}
            >
              {charts.map((c) => (
                <option key={c.kind} value={c.kind}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label style={labelStyle}>Semana</label>
            <select
              value={weekIndex ?? ""}
              onChange={(ev) => {
                const w = Number(ev.target.value);
                setWeekIndex(w);
                void load(chartKind, w);
              }}
              style={compactInput}
              disabled={!weeks.length}
            >
              {!weeks.length && <option value="">Sem snapshots</option>}
              {weeks.map((w) => (
                <option key={w.weekIndex} value={w.weekIndex}>
                  {w.weekLabel}
                  {w.dateRange ? ` · ${w.dateRange}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>Buscar</label>
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Título, artista ou posição…"
              style={compactInput}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {(
            [
              ["all", "Todas"],
              ["new", "Estreias"],
              ["configured", "Configuradas"],
              ["missing", "Sem vídeo"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              style={{
                ...chipBtn,
                background: filter === id ? "var(--text)" : "var(--surface)",
                color: filter === id ? "var(--bg, #fff)" : "var(--text)",
                borderColor: filter === id ? "var(--text)" : "var(--divider-strong)",
              }}
            >
              {label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button type="button" onClick={resetDirty} disabled={!dirtySongIds.length || saving} style={chipBtn}>
            <RotateCcw size={14} />
            Descartar
          </button>
          <button
            type="button"
            onClick={() => void saveDirty()}
            disabled={!dirtySongIds.length || saving || weekIndex == null}
            style={{
              ...primaryBtn,
              opacity: !dirtySongIds.length || saving ? 0.55 : 1,
            }}
          >
            <Save size={14} />
            {saving ? "Salvando…" : `Salvar (${dirtySongIds.length})`}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: error ? "rgba(250,36,60,0.08)" : "rgba(0,160,80,0.08)",
            color: error ? "#FA243C" : "var(--text)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error || message}
        </div>
      )}

      <div style={{ ...adminPanelStyle, marginBottom: 8 }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--divider)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <Film size={16} color="#FA243C" />
          <strong>{chartLabel}</strong>
          <span style={{ color: "var(--text-muted)" }}>
            {weekLabel ?? "—"}
            {dateRange ? ` · ${dateRange}` : ""}
          </span>
          <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>
            {loading ? "Carregando…" : `${filtered.length} de ${entries.length} músicas`}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ ...adminCompactThStyle, width: 44 }}>#</th>
                <th style={{ ...adminCompactThStyle, width: 220 }}>Música</th>
                <th style={{ ...adminCompactThStyle, width: 52 }}>Status</th>
                <th style={{ ...adminCompactThStyle, minWidth: 220 }}>URL do vídeo</th>
                <th style={{ ...adminCompactThStyle, width: 110 }}>Plataforma</th>
                <th style={{ ...adminCompactThStyle, width: 72 }}>Início</th>
                <th style={{ ...adminCompactThStyle, width: 72 }}>Fim</th>
                <th style={{ ...adminCompactThStyle, width: 88 }}>Auto</th>
                <th style={{ ...adminCompactThStyle, width: 72 }}>Estreia</th>
                <th style={{ ...adminCompactThStyle, width: 72 }}>Ignorar</th>
                <th style={{ ...adminCompactThStyle, minWidth: 140 }}>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ ...adminCompactTdStyle, color: "var(--text-muted)" }}>
                    Nenhuma música neste filtro.
                  </td>
                </tr>
              )}
              {filtered.map((e) => {
                const d = drafts[e.songId] ?? entryToDraft(e);
                const dirty = dirtySongIds.includes(e.songId);
                const suggested = e.suggestedYoutubeId
                  ? `https://www.youtube.com/watch?v=${e.suggestedYoutubeId}`
                  : "";
                return (
                  <tr
                    key={e.songId}
                    style={{
                      background: dirty ? "rgba(250,36,60,0.04)" : undefined,
                    }}
                  >
                    <td style={{ ...adminCompactTdStyle, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {e.position}
                    </td>
                    <td style={adminCompactTdStyle}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {e.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.coverUrl}
                            alt=""
                            width={36}
                            height={36}
                            style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: "var(--divider)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={e.title}
                          >
                            {e.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={e.artist}
                          >
                            {e.artist}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={adminCompactTdStyle}>
                      <StatusBadge status={e.status} forceDebut={d.forceDebut} />
                    </td>
                    <td style={adminCompactTdStyle}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          value={d.videoUrl}
                          onChange={(ev) => updateDraft(e.songId, { videoUrl: ev.target.value })}
                          placeholder={suggested || "https://…"}
                          style={{ ...compactInput, flex: 1 }}
                        />
                        {e.suggestedYoutubeId && !d.videoUrl && (
                          <button
                            type="button"
                            title="Usar clipe oficial sugerido"
                            onClick={() => applySuggestedUrl(e.songId, e.suggestedYoutubeId)}
                            style={{ ...chipBtn, padding: "6px 8px" }}
                          >
                            YT
                          </button>
                        )}
                        {d.videoUrl && (
                          <a
                            href={d.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--text-muted)", display: "inline-flex" }}
                            title="Abrir URL"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => applyDefaultDuration(e.songId, VIDEOPARADA_SHORTS_SECONDS)}
                          style={{ ...chipBtn, padding: "3px 7px", fontSize: 11 }}
                          title={`Trecho de ${VIDEOPARADA_SHORTS_SECONDS}s (Shorts)`}
                        >
                          {VIDEOPARADA_SHORTS_SECONDS}s
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDefaultDuration(e.songId, VIDEOPARADA_YOUTUBE_SECONDS)}
                          style={{ ...chipBtn, padding: "3px 7px", fontSize: 11 }}
                          title={`Trecho de ${VIDEOPARADA_YOUTUBE_SECONDS}s (YouTube)`}
                        >
                          {VIDEOPARADA_YOUTUBE_SECONDS}s
                        </button>
                      </div>
                    </td>
                    <td style={adminCompactTdStyle}>
                      <select
                        value={d.platform}
                        onChange={(ev) => updateDraft(e.songId, { platform: ev.target.value })}
                        style={compactInput}
                      >
                        <option value="">Auto</option>
                        {VIDEOPARADA_PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={adminCompactTdStyle}>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={d.startSeconds}
                        onChange={(ev) => updateDraft(e.songId, { startSeconds: ev.target.value })}
                        disabled={d.useAutoChorus}
                        style={{ ...compactInput, opacity: d.useAutoChorus ? 0.5 : 1 }}
                      />
                    </td>
                    <td style={adminCompactTdStyle}>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={d.endSeconds}
                        onChange={(ev) => updateDraft(e.songId, { endSeconds: ev.target.value })}
                        disabled={d.useAutoChorus}
                        style={{ ...compactInput, opacity: d.useAutoChorus ? 0.5 : 1 }}
                      />
                    </td>
                    <td style={{ ...adminCompactTdStyle, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={d.useAutoChorus}
                        onChange={(ev) =>
                          updateDraft(e.songId, {
                            useAutoChorus: ev.target.checked,
                          })
                        }
                        title="Utilizar trecho automático (refrão)"
                      />
                    </td>
                    <td style={{ ...adminCompactTdStyle, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={d.forceDebut}
                        onChange={(ev) => updateDraft(e.songId, { forceDebut: ev.target.checked })}
                        title="Forçar animação de estreia (NEW)"
                      />
                    </td>
                    <td style={{ ...adminCompactTdStyle, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={d.skipAutoVideo}
                        onChange={(ev) => updateDraft(e.songId, { skipAutoVideo: ev.target.checked })}
                        title="Ignorar vídeo automático"
                      />
                    </td>
                    <td style={adminCompactTdStyle}>
                      <input
                        value={d.notes}
                        onChange={(ev) => updateDraft(e.songId, { notes: ev.target.value })}
                        placeholder="—"
                        style={compactInput}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
