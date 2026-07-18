"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type PeakPotential = "1" | "top3" | "top5" | "top10" | "top20" | "top40" | "top100" | "out";
type HitLevel = "diamond" | "platinum" | "gold" | "silver" | "bronze" | "none";
type Priority = "S" | "A" | "B" | "C" | "D";
type Confidence = "alta" | "media" | "baixa";
type RetroMode = "historico" | "retrospectivo";
type RetroTarget = "hot100" | "clipes";
type ReleaseRefSource = "single" | "album" | "clipe" | "top20" | "billboard";

interface ScoreBreakdown {
  period: number;
  importance: number;
  top20: number;
  releaseRecency: number;
  clip: number;
  adjust: number;
}

interface RetroEntry {
  songId: string;
  position: number | null; // null = marcada como "Fora" (não concorre)
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  singleReleaseDate: string | null;
  albumReleaseDate: string | null;
  youtubeReleaseDate: string | null;
  releaseRef: string | null;
  releaseRefSource: ReleaseRefSource | null;
  importance: number;
  importanceIsManual: boolean;
  importanceLocked: boolean;
  scoreFinal: number;
  breakdown: ScoreBreakdown;
  peakPotential: PeakPotential;
  peakPotentialIsManual: boolean;
  hitLevel: HitLevel;
  priority: Priority;
  confidence: Confidence;
  eraWeight: number;
  overallPlaycount: number;
  periodPlaycount: number | null;
  top20Weeks: number;
  top20BestPeak: number | null;
  numberOnes: number;
  manualAdjustment: number;
  note: string | null;
  billboardHot100DebutDate: string | null;
}

interface RetroResponse {
  period: { year: number; month: number; mode: RetroMode; target: RetroTarget };
  chartDate: string;
  usesRealPeriodData: boolean;
  stats: {
    eligible: number;
    withPeriodPlays: number;
    everInTop20: number;
    everNumberOne: number;
    diamonds: number;
    excludedOut: number;
    catalogOnly: number;
    matched: number;
    unmatched: number;
  };
  entries: RetroEntry[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PEAK_LABEL: Record<PeakPotential, string> = {
  "1": "#1", top3: "Top 3", top5: "Top 5", top10: "Top 10",
  top20: "Top 20", top40: "Top 40", top100: "Top 100", out: "Fora",
};
const PEAK_ORDER: PeakPotential[] = ["1", "top3", "top5", "top10", "top20", "top40", "top100", "out"];

const HIT_BADGE: Record<HitLevel, { label: string; fg: string; bg: string }> = {
  diamond: { label: "Diamond", fg: "#06B6D4", bg: "rgba(6, 182, 212, 0.13)" },
  platinum: { label: "Platinum", fg: "#8B5CF6", bg: "rgba(139, 92, 246, 0.13)" },
  gold: { label: "Gold", fg: "#D97706", bg: "rgba(217, 119, 6, 0.13)" },
  silver: { label: "Silver", fg: "var(--text-subtle)", bg: "var(--fill-subtle)" },
  bronze: { label: "Bronze", fg: "#B45309", bg: "rgba(180, 83, 9, 0.15)" },
  none: { label: "—", fg: "var(--text-muted)", bg: "var(--fill-subtle)" },
};

const PRIORITY_BADGE: Record<Priority, { fg: string; bg: string }> = {
  S: { fg: "#E11D48", bg: "rgba(225, 29, 72, 0.13)" },
  A: { fg: "#C026D3", bg: "rgba(192, 38, 211, 0.12)" },
  B: { fg: "#4F46E5", bg: "rgba(79, 70, 229, 0.12)" },
  C: { fg: "#0284C7", bg: "rgba(2, 132, 199, 0.12)" },
  D: { fg: "var(--text-muted)", bg: "var(--fill-subtle)" },
};

const CONFIDENCE_LABEL: Record<Confidence, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

const TARGET_LABEL: Record<RetroTarget, string> = {
  hot100: "Hot 100 de Singles",
  clipes: "Top 20 de Clipes",
};

const SOURCE_LABEL: Record<ReleaseRefSource, string> = {
  single: "single",
  album: "álbum",
  clipe: "clipe",
  top20: "Top 20",
  billboard: "Billboard",
};

const WEIGHT_ROWS: { key: keyof ScoreBreakdown; label: string; max: number; color: string }[] = [
  { key: "period", label: "Plays do período", max: 30, color: "#10B981" },
  { key: "importance", label: "Importância", max: 30, color: "#0EA5E9" },
  { key: "top20", label: "Histórico Top 20", max: 15, color: "#8B5CF6" },
  { key: "releaseRecency", label: "Recência do lançamento", max: 10, color: "#F59E0B" },
  { key: "clip", label: "Data do clipe", max: 10, color: "#06B6D4" },
  { key: "adjust", label: "Ajustes manuais", max: 5, color: "#F43F5E" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2000 + 1 }, (_, i) => CURRENT_YEAR - i);
const PAGE_SIZE = 50;

// ── estilos base ──────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 16,
};

const inputStyle: CSSProperties = {
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  outline: "none",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const badgeStyle = (fg: string, bg: string): CSSProperties => ({
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 7,
  fontSize: 11,
  fontWeight: 700,
  color: fg,
  background: bg,
  whiteSpace: "nowrap",
});

const thStyle: CSSProperties = {
  padding: "10px 10px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--divider)",
};

const tdStyle: CSSProperties = {
  padding: "10px 10px",
  fontSize: 13,
  color: "var(--text)",
  borderBottom: "1px solid var(--divider-soft)",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const num: CSSProperties = { fontVariantNumeric: "tabular-nums" };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(" de ", " ")
    .replace(".", "");
}

function scoreHue(pct: number): number {
  return 120 * (Math.max(0, Math.min(100, pct)) / 100);
}

// ── componentes visuais ───────────────────────────────────────────────────

function ScoreRing({ value, size = 40 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const inner = size - 10;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: `conic-gradient(hsl(${scoreHue(pct)} 65% 45%) ${pct}%, var(--fill-subtle) 0)`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: inner,
          height: inner,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "var(--surface)",
          color: "var(--text)",
          fontWeight: 700,
          fontSize: size / 3.4,
          ...num,
        }}
      >
        {Math.round(pct)}
      </span>
    </div>
  );
}

function ImportanceMeter({ value, manual }: { value: number; manual: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, width: 24, textAlign: "right", ...num }}>{Math.round(pct)}</span>
      <div style={{ width: 44, height: 5, borderRadius: 99, background: "var(--fill-subtle)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `hsl(${scoreHue(pct)} 65% 45%)` }} />
      </div>
      {manual && (
        <span title="Ajustada manualmente" style={{ fontSize: 11, color: "var(--accent)" }}>✎</span>
      )}
    </div>
  );
}

function Cover({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <div
        style={{
          width: 36, height: 36, borderRadius: 8, background: "var(--fill-subtle)",
          display: "grid", placeItems: "center", fontSize: 14, color: "var(--text-muted)", flexShrink: 0,
        }}
      >
        ♪
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={title} width={36} height={36} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", ...num }}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function reasonsFor(e: RetroEntry): string[] {
  const r: string[] = [];
  if (e.importance >= 80) r.push(`Importância muito alta (${Math.round(e.importance)}/100)`);
  if (e.periodPlaycount && e.periodPlaycount > 0) r.push(`${e.periodPlaycount} plays no período`);
  else if (e.overallPlaycount > 0) r.push(`${e.overallPlaycount.toLocaleString("pt-BR")} plays no total`);
  if (e.numberOnes > 0) r.push(`Já teve ${e.numberOnes}× #1 na sua Top 20`);
  if (e.top20BestPeak != null) r.push(`Pico #${e.top20BestPeak} na sua Top 20`);
  if (e.top20Weeks > 0) r.push(`${e.top20Weeks} semanas na Top 20`);
  if (e.breakdown.clip > 0) r.push("Clipe lançado antes da data do chart");
  return r;
}

interface Draft {
  impManual: boolean;
  impValue: number;
  peak: PeakPotential | "auto";
  adjust: number;
  note: string;
  billboardDebut: string; // yyyy-mm-dd ou ""
}

function draftFrom(e: RetroEntry): Draft {
  return {
    impManual: e.importanceIsManual,
    impValue: Math.round(e.importance),
    peak: e.peakPotentialIsManual ? e.peakPotential : "auto",
    adjust: e.manualAdjustment,
    note: e.note ?? "",
    billboardDebut: e.billboardHot100DebutDate ?? "",
  };
}

// ── geração de histórico (estreia + carry-over → Chart/ChartEntry reais) ──

interface WeekSampleEntry {
  position: number;
  status: string;
  songId: string;
  title: string;
  artist: string;
}
interface WeekSample {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  top5: WeekSampleEntry[];
}
interface PreviewResponse {
  dryRun: true;
  paradaId: string;
  chartSize: number;
  startYear: number;
  boundaryWeekIndex: number;
  boundaryWeekLabel: string | null;
  monthsScanned: number;
  totalDebuts: number;
  weeksToCreate: number;
  firstWeek: WeekSample | null;
  lastWeek: WeekSample | null;
}
interface PublishResponse {
  dryRun: false;
  created: number;
  skippedExisting: number;
  remaining: number;
}

interface ParadaOption {
  id: string;
  name: string;
}

function HistoryGenerationPanel({ target }: { target: RetroTarget }) {
  const [startYear, setStartYear] = useState(2000);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [loading, setLoading] = useState<"preview" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paradas, setParadas] = useState<ParadaOption[]>([]);
  const [paradaId, setParadaId] = useState(""); // vazio = usa a parada padrão do target

  useEffect(() => {
    fetch("/api/user/paradas")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.paradas) {
          setParadas(body.paradas.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => {});
  }, []);

  async function callPublish(dryRun: boolean) {
    setLoading(dryRun ? "preview" : "publish");
    setError(null);
    try {
      const res = await fetch("/api/retro/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, startYear, dryRun, paradaId: paradaId || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "erro");
        return;
      }
      if (dryRun) {
        setPreview(body as PreviewResponse);
        setPublishResult(null);
      } else {
        setPublishResult(body as PublishResponse);
      }
    } catch {
      setError("network");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Gerar histórico da parada</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          Simula semana a semana (estreia + carry-over) desde o ano escolhido até a semana real mais antiga já
          publicada em {TARGET_LABEL[target]}, e publica como Chart de verdade. Nunca sobrescreve uma semana que já existe.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Publicar em</span>
          <select value={paradaId} onChange={(ev) => setParadaId(ev.target.value)} style={inputStyle}>
            <option value="">Padrão ({TARGET_LABEL[target]})</option>
            {paradas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Começar em</span>
          <select value={startYear} onChange={(ev) => setStartYear(Number(ev.target.value))} style={inputStyle}>
            {YEARS.slice().reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button
          onClick={() => void callPublish(true)}
          disabled={loading !== null}
          style={{ ...inputStyle, padding: "10px 16px", fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading === "preview" ? "Simulando…" : "Simular (preview)"}
        </button>
        {preview && preview.weeksToCreate > 0 && (
          <button
            onClick={() => void callPublish(false)}
            disabled={loading !== null}
            style={{
              background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 16px", fontSize: 14, fontWeight: 600,
              cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            {loading === "publish" ? "Publicando…" : "Publicar"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "var(--down-fg)" }}>Erro: {error}</div>
      )}

      {preview && (
        <div style={{ fontSize: 13, color: "var(--text-subtle)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{preview.weeksToCreate}</strong> semanas seriam geradas · <strong>{preview.totalDebuts}</strong> estreias ·{" "}
            {preview.monthsScanned} meses varridos · fronteira real: {preview.boundaryWeekLabel ?? "nenhuma ainda"} (weekIndex {preview.boundaryWeekIndex})
          </div>
          {preview.firstWeek && (
            <div>
              1ª semana: {preview.firstWeek.weekLabel} ({preview.firstWeek.dateRange}) — top 5:{" "}
              {preview.firstWeek.top5.map((e) => `#${e.position} ${e.title}`).join(", ")}
            </div>
          )}
          {preview.lastWeek && preview.lastWeek.weekIndex !== preview.firstWeek?.weekIndex && (
            <div>
              Última semana: {preview.lastWeek.weekLabel} ({preview.lastWeek.dateRange}) — top 5:{" "}
              {preview.lastWeek.top5.map((e) => `#${e.position} ${e.title}`).join(", ")}
            </div>
          )}
          {preview.weeksToCreate === 0 && (
            <div>Nada a gerar — ou o ano escolhido já está dentro do histórico real, ou não há estreias elegíveis.</div>
          )}
        </div>
      )}

      {publishResult && (
        <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>
          <strong>{publishResult.created}</strong> semanas publicadas · {publishResult.skippedExisting} já existiam ·{" "}
          {publishResult.remaining > 0 ? (
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {publishResult.remaining} restantes — clique em Publicar de novo para continuar.
            </span>
          ) : (
            <span>backfill completo até a fronteira real.</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── página ────────────────────────────────────────────────────────────────

export function RetroClient() {
  const [year, setYear] = useState(2005);
  const [month, setMonth] = useState(5);
  const [mode, setMode] = useState<RetroMode>("retrospectivo");
  const [target, setTarget] = useState<RetroTarget>("hot100");
  const [data, setData] = useState<RetroResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const selected = useMemo(
    () => data?.entries.find((e) => e.songId === selectedId) ?? null,
    [data, selectedId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.entries;
    return data.entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/retro/chart?year=${year}&month=${month}&mode=${mode}&target=${target}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "erro");
        setData(null);
      } else {
        setData(body as RetroResponse);
        setPage(1);
        setChecked(new Set());
      }
    } catch {
      setError("network");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, mode, target]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openSong(e: RetroEntry) {
    setSelectedId(e.songId);
    setDraft(draftFrom(e));
  }

  function toggleChecked(songId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }

  const allPageChecked = pageRows.length > 0 && pageRows.every((e) => checked.has(e.songId));

  function togglePageAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allPageChecked) pageRows.forEach((e) => next.delete(e.songId));
      else pageRows.forEach((e) => next.add(e.songId));
      return next;
    });
  }

  async function bulkSetOut(out: boolean) {
    if (checked.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/retro/song-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: Array.from(checked), peakPotential: out ? "out" : null }),
      });
      if (res.ok) {
        setChecked(new Set());
        await load();
      }
    } finally {
      setBulkSaving(false);
    }
  }

  async function saveDraft() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/retro/song-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: selected.songId,
          importance: draft.impManual ? draft.impValue : null,
          peakPotential: draft.peak === "auto" ? null : draft.peak,
          manualAdjustment: draft.adjust,
          note: draft.note.trim() === "" ? null : draft.note,
          billboardHot100DebutDate: draft.billboardDebut.trim() === "" ? null : draft.billboardDebut,
        }),
      });
      if (res.ok) {
        await load();
        // Re-sincroniza o rascunho com os valores recalculados.
        setData((prev) => {
          const fresh = prev?.entries.find((e) => e.songId === selected.songId);
          if (fresh) setDraft(draftFrom(fresh));
          return prev;
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        .retro-row { cursor: pointer; transition: background 120ms ease; }
        .retro-row:hover { background: var(--fill-subtle); }
        .retro-input:focus { border-color: var(--accent) !important; }
        input[type="range"].retro-range { accent-color: var(--accent); }
      `}</style>

      {/* Controles */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Período da parada</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={month} onChange={(ev) => setMonth(Number(ev.target.value))} style={inputStyle}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(ev) => setYear(Number(ev.target.value))} style={inputStyle}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Parada</span>
          <select value={target} onChange={(ev) => setTarget(ev.target.value as RetroTarget)} style={inputStyle}>
            <option value="hot100">{TARGET_LABEL.hot100}</option>
            <option value="clipes">{TARGET_LABEL.clipes}</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Modo</span>
          <select value={mode} onChange={(ev) => setMode(ev.target.value as RetroMode)} style={inputStyle}>
            <option value="retrospectivo">Retrospectivo</option>
            <option value="historico">Histórico</option>
          </select>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Calculando…" : "↻ Recalcular"}
        </button>
      </div>

      {error === "no_lastfm_user" && (
        <div style={{ ...card, borderColor: "rgba(217, 119, 6, 0.4)", background: "rgba(217, 119, 6, 0.08)", padding: "12px 16px", fontSize: 14, color: "#B45309" }}>
          Nenhum usuário do Last.fm configurado na sua conta.
        </div>
      )}
      {error && error !== "no_lastfm_user" && (
        <div style={{ ...card, borderColor: "rgba(225, 29, 72, 0.4)", background: "rgba(225, 29, 72, 0.08)", padding: "12px 16px", fontSize: 14, color: "var(--down-fg)" }}>
          Não foi possível carregar a parada ({error}).
        </div>
      )}

      {loading && !data && (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Montando sua parada retrospectiva… isso pode levar alguns segundos.
        </div>
      )}

      {data && (
        <>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Lançamentos de {MONTHS[data.period.month - 1]} de {data.period.year} — candidatas a estreia na{" "}
            {TARGET_LABEL[data.period.target]} ·{" "}
            {data.usesRealPeriodData ? "plays reais do período" : "antes de Out/2010 → estimado"} ·{" "}
            {data.stats.matched} faixas da biblioteca casadas ({data.stats.unmatched} sem correspondência)
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <StatTile value={data.stats.eligible} label="Candidatas a estreia" />
            <StatTile value={data.stats.catalogOnly} label="Só no catálogo (sem plays)" />
            <StatTile value={data.stats.withPeriodPlays} label="Com plays no período" />
            <StatTile value={data.stats.everInTop20} label="Já entraram na Top 20" />
            <StatTile value={data.stats.everNumberOne} label="Tiveram #1" />
            <StatTile value={data.stats.diamonds} label="Diamonds" />
            <StatTile value={data.stats.excludedOut} label="Marcadas como Fora" />
          </div>

          {/* Busca + ações em lote */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <input
              value={search}
              onChange={(ev) => { setSearch(ev.target.value); setPage(1); }}
              placeholder="Buscar música ou artista…"
              className="retro-input"
              style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 340 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)", ...num }}>
              {filtered.length === data.entries.length
                ? `${data.entries.length} posições`
                : `${filtered.length} de ${data.entries.length} posições`}
            </span>

            {checked.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", ...num }}>{checked.size} selecionadas</span>
                <button
                  onClick={() => void bulkSetOut(true)}
                  disabled={bulkSaving}
                  style={{ ...inputStyle, padding: "6px 12px", fontWeight: 600, cursor: bulkSaving ? "default" : "pointer", opacity: bulkSaving ? 0.6 : 1 }}
                >
                  Marcar como Fora
                </button>
                <button
                  onClick={() => void bulkSetOut(false)}
                  disabled={bulkSaving}
                  style={{ ...inputStyle, padding: "6px 12px", cursor: bulkSaving ? "default" : "pointer", opacity: bulkSaving ? 0.6 : 1 }}
                >
                  Desfazer exclusão
                </button>
                <button
                  onClick={() => setChecked(new Set())}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>

          {/* Tabela */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 32 }}>
                      <input
                        type="checkbox"
                        checked={allPageChecked}
                        onChange={togglePageAll}
                        onClick={(ev) => ev.stopPropagation()}
                        style={{ accentColor: "var(--accent)" }}
                        aria-label="Selecionar todas desta página"
                      />
                    </th>
                    <th style={{ ...thStyle, width: 40 }}>#</th>
                    <th style={thStyle}>Música</th>
                    <th style={thStyle}>Estreia</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Mês</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                    <th style={thStyle}>Single</th>
                    <th style={thStyle}>Clipe</th>
                    <th style={thStyle}>Álbum</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Pico</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Sem.</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>#1s</th>
                    <th style={thStyle}>Importância</th>
                    <th style={thStyle}>Peak</th>
                    <th style={thStyle}>Hit Level</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Prio.</th>
                    <th style={thStyle}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((e) => {
                    const isOut = e.position == null;
                    return (
                    <tr
                      key={e.songId}
                      className="retro-row"
                      onClick={() => openSong(e)}
                      style={{
                        ...(selectedId === e.songId ? { background: "var(--accent-tint)" } : undefined),
                        opacity: isOut ? 0.55 : 1,
                      }}
                    >
                      <td style={tdStyle} onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(e.songId)}
                          onChange={() => toggleChecked(e.songId)}
                          style={{ accentColor: "var(--accent)" }}
                          aria-label={`Selecionar ${e.title}`}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", fontWeight: 600, ...num }}>
                        {e.position ?? <span title="Marcada como Fora">—</span>}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Cover url={e.coverUrl} title={e.title} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{e.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                              {e.artist}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmtDate(e.releaseRef?.slice(0, 10) ?? null)}</span>
                        {e.releaseRefSource && (
                          <span style={{ ...badgeStyle("var(--text-subtle)", "var(--fill-subtle)"), marginLeft: 6, fontWeight: 600 }}>
                            {SOURCE_LABEL[e.releaseRefSource]}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", ...num }}>
                        {e.periodPlaycount == null ? <span style={{ color: "var(--text-muted)" }}>est.</span> : e.periodPlaycount}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", ...num }}>{e.overallPlaycount.toLocaleString("pt-BR")}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: e.singleReleaseDate ? "var(--text-subtle)" : "var(--text-disabled)" }}>
                        {fmtDate(e.singleReleaseDate)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: e.youtubeReleaseDate ? "var(--text-subtle)" : "var(--text-disabled)" }}>
                        {fmtDate(e.youtubeReleaseDate)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: e.albumReleaseDate ? "var(--text-subtle)" : "var(--text-disabled)" }}>
                        {fmtDate(e.albumReleaseDate)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", ...num }}>
                        {e.top20BestPeak != null ? `#${e.top20BestPeak}` : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", ...num }}>{e.top20Weeks || <span style={{ color: "var(--text-disabled)" }}>—</span>}</td>
                      <td style={{ ...tdStyle, textAlign: "center", ...num }}>{e.numberOnes || <span style={{ color: "var(--text-disabled)" }}>—</span>}</td>
                      <td style={tdStyle}><ImportanceMeter value={e.importance} manual={e.importanceIsManual} /></td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {isOut ? (
                          <span style={badgeStyle("var(--down-fg)", "var(--down-bg)")}>Fora</span>
                        ) : (
                          <>
                            {PEAK_LABEL[e.peakPotential]}
                            {e.peakPotentialIsManual && <span title="Definido manualmente" style={{ marginLeft: 4, fontSize: 11, color: "var(--accent)" }}>✎</span>}
                          </>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={badgeStyle(HIT_BADGE[e.hitLevel].fg, HIT_BADGE[e.hitLevel].bg)}>{HIT_BADGE[e.hitLevel].label}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={badgeStyle(PRIORITY_BADGE[e.priority].fg, PRIORITY_BADGE[e.priority].bg)}>{e.priority}</span>
                      </td>
                      <td style={tdStyle}>{isOut ? <span style={{ color: "var(--text-disabled)" }}>—</span> : <ScoreRing value={e.scoreFinal} />}</td>
                    </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={17} style={{ ...tdStyle, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        {search ? "Nenhuma música encontrada para a busca." : "Nenhum lançamento seu neste mês (pela cadeia single → álbum → clipe → 1ª entrada Top 20)."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {filtered.length > PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--divider)" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", ...num }}>
                  Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    style={{ ...inputStyle, padding: "6px 12px", cursor: safePage <= 1 ? "default" : "pointer", opacity: safePage <= 1 ? 0.4 : 1 }}
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    style={{ ...inputStyle, padding: "6px 12px", cursor: safePage >= totalPages ? "default" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1 }}
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </div>

          <HistoryGenerationPanel target={target} />
        </>
      )}

      {/* Painel lateral de detalhes */}
      {selected && draft && (
        <>
          <div
            onClick={() => setSelectedId(null)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0, 0, 0, 0.45)" }}
          />
          <aside
            style={{
              position: "fixed", right: 0, top: 0, zIndex: 50, height: "100%",
              width: "min(420px, 100vw)", overflowY: "auto",
              background: "var(--surface)", borderLeft: "1px solid var(--divider)",
              padding: 20, boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.25)",
              display: "flex", flexDirection: "column", gap: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Cover url={selected.coverUrl} title={selected.title} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>#{selected.position} · Detalhes da música</div>
                <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{selected.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {selected.artist}{selected.album ? ` · ${selected.album}` : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: 4 }}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
              <ScoreRing value={selected.scoreFinal} size={56} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Score Final</div>
                <div style={{ fontSize: 20, fontWeight: 700, ...num }}>
                  {selected.scoreFinal.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>/ 100</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Pico provável {PEAK_LABEL[selected.peakPotential]} · Confiança {CONFIDENCE_LABEL[selected.confidence]}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Estreia {fmtDate(selected.releaseRef?.slice(0, 10) ?? null)}
                  {selected.releaseRefSource ? ` (via ${SOURCE_LABEL[selected.releaseRefSource]})` : ""}
                </div>
              </div>
            </div>

            {/* Por que está aqui */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Por que essa música está aqui?</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {reasonsFor(selected).map((r) => (
                  <li key={r} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-subtle)" }}>
                    <span style={{ color: "var(--up-fg)" }}>✔</span>{r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pesos do cálculo */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pesos do cálculo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {WEIGHT_ROWS.map((w) => {
                  const val = selected.breakdown[w.key];
                  return (
                    <div key={w.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                        <span>{w.label}</span>
                        <span style={num}>{val.toFixed(1)} / {w.max}</span>
                      </div>
                      <div style={{ marginTop: 4, height: 6, borderRadius: 99, background: "var(--fill-subtle)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 99, background: w.color, width: `${Math.min(100, (val / w.max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editor */}
            <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Importância */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Importância</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={draft.impManual}
                      onChange={(ev) => setDraft({ ...draft, impManual: ev.target.checked })}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    Manual
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range" min={0} max={100} value={draft.impValue} disabled={!draft.impManual}
                    onChange={(ev) => setDraft({ ...draft, impValue: Number(ev.target.value) })}
                    className="retro-range"
                    style={{ flex: 1, opacity: draft.impManual ? 1 : 0.4 }}
                  />
                  <span style={{ width: 32, textAlign: "right", fontSize: 14, fontWeight: 600, ...num }}>
                    {draft.impManual ? draft.impValue : Math.round(selected.importance)}
                  </span>
                </div>
                {!draft.impManual && (
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>Usando valor calculado automaticamente.</div>
                )}
              </div>

              {/* Peak Potential */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Peak Potential</div>
                <select
                  value={draft.peak}
                  onChange={(ev) => setDraft({ ...draft, peak: ev.target.value as Draft["peak"] })}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="auto">Automático ({PEAK_LABEL[selected.peakPotential]})</option>
                  {PEAK_ORDER.map((p) => <option key={p} value={p}>{PEAK_LABEL[p]}</option>)}
                </select>
              </div>

              {/* Estreia na Billboard Hot 100 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Estreia na Billboard Hot 100</div>
                <input
                  type="date"
                  value={draft.billboardDebut}
                  onChange={(ev) => setDraft({ ...draft, billboardDebut: ev.target.value })}
                  className="retro-input"
                  style={{ ...inputStyle, width: "100%" }}
                />
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  Só usada na Hot 100 de Singles: se for anterior à data do single e à 1ª entrada dela na sua Top 20, vence as duas como data de estreia.
                </div>
              </div>

              {/* Ajuste manual */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Ajuste manual</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", ...num }}>
                    {draft.adjust > 0 ? `+${draft.adjust}` : draft.adjust}
                  </span>
                </div>
                <input
                  type="range" min={-50} max={50} value={draft.adjust}
                  onChange={(ev) => setDraft({ ...draft, adjust: Number(ev.target.value) })}
                  className="retro-range"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Nota */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Observação pessoal</div>
                <textarea
                  value={draft.note}
                  onChange={(ev) => setDraft({ ...draft, note: ev.target.value })}
                  rows={3}
                  placeholder="Essa música marcou minha adolescência…"
                  className="retro-input"
                  style={{ ...inputStyle, width: "100%", resize: "none", fontFamily: "inherit" }}
                />
              </div>

              <button
                onClick={() => void saveDraft()}
                disabled={saving}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10,
                  padding: "11px 18px", fontSize: 14, fontWeight: 600,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Salvando…" : "Salvar e recalcular"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
