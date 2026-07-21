"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "@/hooks/useTranslations";

type TFn = ReturnType<typeof useTranslations>["t"];

type PeakPotential =
  | "1" | "top5" | "top10" | "top20" | "top30" | "top40"
  | "top50" | "top60" | "top70" | "top80" | "top90" | "top100" | "out";
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
  songBillboardHot100DebutDate: string | null;
  top20FirstEntryDate: string | null;
  debutSourcePreferred: ReleaseRefSource | null;
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

function getMonths(t: TFn): string[] {
  return [
    t("retro.monthJanuary"), t("retro.monthFebruary"), t("retro.monthMarch"), t("retro.monthApril"),
    t("retro.monthMay"), t("retro.monthJune"), t("retro.monthJuly"), t("retro.monthAugust"),
    t("retro.monthSeptember"), t("retro.monthOctober"), t("retro.monthNovember"), t("retro.monthDecember"),
  ];
}

function monthYear(t: TFn, months: string[], month: number, year: number): string {
  return t("retro.monthYear", { month: months[month - 1], year });
}

function getPeakLabel(t: TFn): Record<PeakPotential, string> {
  return {
    "1": t("retro.peakOne"),
    top5: t("retro.peakTop5"),
    top10: t("retro.peakTop10"),
    top20: t("retro.peakTop20"),
    top30: t("retro.peakTop30"),
    top40: t("retro.peakTop40"),
    top50: t("retro.peakTop50"),
    top60: t("retro.peakTop60"),
    top70: t("retro.peakTop70"),
    top80: t("retro.peakTop80"),
    top90: t("retro.peakTop90"),
    top100: t("retro.peakTop100"),
    out: t("retro.peakOut"),
  };
}
const PEAK_ORDER: PeakPotential[] = [
  "1", "top5", "top10", "top20", "top30", "top40",
  "top50", "top60", "top70", "top80", "top90", "top100", "out",
];

// Diamond/Platinum/Gold/Silver/Bronze: termos de certificação usados sem tradução em ambos os idiomas.
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

function getConfidenceLabel(t: TFn): Record<Confidence, string> {
  return { alta: t("retro.confidenceHigh"), media: t("retro.confidenceMedium"), baixa: t("retro.confidenceLow") };
}

function getTargetLabel(t: TFn): Record<RetroTarget, string> {
  return {
    hot100: t("retro.targetHot100"),
    clipes: t("retro.targetClipes"),
  };
}

function getSourceLabel(t: TFn): Record<ReleaseRefSource, string> {
  return {
    single: "single",
    album: t("retro.sourceAlbumLabel"),
    clipe: t("retro.sourceClipeLabel"),
    top20: "Top 20",
    billboard: "Billboard",
  };
}

function getWeightRows(t: TFn): { key: keyof ScoreBreakdown; label: string; max: number; color: string }[] {
  return [
    { key: "period", label: t("retro.weightPeriod"), max: 25, color: "#10B981" },
    { key: "importance", label: t("retro.weightImportance"), max: 30, color: "#0EA5E9" },
    { key: "top20", label: t("retro.weightTop20"), max: 30, color: "#8B5CF6" },
    { key: "releaseRecency", label: t("retro.weightReleaseRecency"), max: 10, color: "#F59E0B" },
    { key: "adjust", label: t("retro.weightAdjust"), max: 5, color: "#F43F5E" },
  ];
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_HISTORY_YEAR = 1990;
/** Anos selecionáveis no período e no “histórico desde” (1990 → atual). */
const YEARS = Array.from({ length: CURRENT_YEAR - MIN_HISTORY_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const PAGE_SIZE = 50;

/** Um ano antes do mês “até” — aquece o Hot 100 com ~12 meses de estreias. */
function defaultHistoryStart(throughYear: number, throughMonth: number): { year: number; month: number } {
  const year = throughYear - 1;
  if (year < MIN_HISTORY_YEAR) return { year: MIN_HISTORY_YEAR, month: 1 };
  return { year, month: throughMonth };
}

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
  const { t } = useTranslations();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, width: 24, textAlign: "right", ...num }}>{Math.round(pct)}</span>
      <div style={{ width: 44, height: 5, borderRadius: 99, background: "var(--fill-subtle)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `hsl(${scoreHue(pct)} 65% 45%)` }} />
      </div>
      {manual && (
        <span title={t("retro.manuallyAdjustedTooltip")} style={{ fontSize: 11, color: "var(--accent)" }}>✎</span>
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

function reasonsFor(e: RetroEntry, t: TFn): string[] {
  const r: string[] = [];
  if (e.importance >= 80) r.push(t("retro.reasonHighImportance", { value: Math.round(e.importance) }));
  if (e.periodPlaycount && e.periodPlaycount > 0) r.push(t("retro.reasonPeriodPlays", { count: e.periodPlaycount }));
  else if (e.overallPlaycount > 0) r.push(t("retro.reasonTotalPlays", { count: e.overallPlaycount.toLocaleString("pt-BR") }));
  if (e.numberOnes > 0) r.push(t("retro.reasonNumberOnes", { count: e.numberOnes }));
  if (e.top20BestPeak != null) r.push(t("retro.reasonPeak", { peak: e.top20BestPeak }));
  if (e.top20Weeks > 0) r.push(t("retro.reasonWeeks", { count: e.top20Weeks }));
  return r;
}

interface Draft {
  impManual: boolean;
  impValue: number;
  peak: PeakPotential | "auto";
  adjust: number;
  note: string;
  billboardDebut: string; // yyyy-mm-dd ou ""
  debutSource: ReleaseRefSource | "auto";
}

function draftFrom(e: RetroEntry): Draft {
  return {
    impManual: e.importanceIsManual,
    impValue: Math.round(e.importance),
    peak: e.peakPotentialIsManual ? e.peakPotential : "auto",
    adjust: e.manualAdjustment,
    note: e.note ?? "",
    billboardDebut: e.billboardHot100DebutDate ?? "",
    debutSource: e.debutSourcePreferred ?? "auto",
  };
}

/** Datas candidatas a estreia (só as que existem), para o seletor de fonte. */
function debutCandidates(e: RetroEntry, t: TFn): { source: ReleaseRefSource; date: string; label: string }[] {
  const effectiveBb = e.billboardHot100DebutDate ?? e.songBillboardHot100DebutDate;
  const rows: { source: ReleaseRefSource; date: string | null; label: string }[] = [
    { source: "single", date: e.singleReleaseDate, label: "Single" },
    { source: "billboard", date: effectiveBb, label: "Billboard" },
    { source: "album", date: e.albumReleaseDate, label: t("retro.debutLabelAlbum") },
    { source: "clipe", date: e.youtubeReleaseDate, label: t("retro.debutLabelClipe") },
    { source: "top20", date: e.top20FirstEntryDate, label: "Top 20" },
  ];
  return rows
    .filter((r): r is { source: ReleaseRefSource; date: string; label: string } => r.date != null)
    .map((r) => ({ source: r.source, date: r.date, label: r.label }));
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
  startMonth?: number;
  throughYear: number | null;
  throughMonth: number | null;
  boundaryWeekIndex: number;
  boundaryWeekLabel: string | null;
  endWeekIndexExclusive: number;
  monthsScanned: number;
  totalDebuts: number;
  weeksSimulated?: number;
  weeksAlreadyExist?: number;
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

type RetroView = "debuts" | "live";

interface LiveWeekMeta {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  weekStartDate: string;
}

interface LiveEntry {
  position: number;
  songId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  status: "new" | "up" | "down" | "same";
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  power: number;
  scoreFinal: number | null;
  debutDate: string | null;
}

interface LivePreviewResponse {
  period: { year: number; month: number; target: RetroTarget; startYear: number; startMonth?: number };
  chartSize: number;
  totalDebuts: number;
  debutsInMonth: number;
  weeks: LiveWeekMeta[];
  chart: {
    weekIndex: number;
    weekLabel: string;
    dateRange: string;
    weekStartDate: string;
    entries: LiveEntry[];
  } | null;
}

const STATUS_LABEL: Record<LiveEntry["status"], { label: string; color: string }> = {
  new: { label: "NEW", color: "var(--accent)" },
  up: { label: "▲", color: "var(--up-fg, #059669)" },
  down: { label: "▼", color: "var(--down-fg)" },
  same: { label: "═", color: "var(--text-muted)" },
};

function WeeklyLivePreview({
  year,
  month,
  target,
  startYear,
  startMonth,
}: {
  year: number;
  month: number;
  target: RetroTarget;
  startYear: number;
  startMonth: number;
}) {
  const { t } = useTranslations();
  const months = getMonths(t);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LivePreviewResponse | null>(null);
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const startLabel = monthYear(t, months, startMonth, startYear);

  const load = useCallback(async (wi?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        target,
        startYear: String(startYear),
        startMonth: String(startMonth),
      });
      if (wi != null) qs.set("weekIndex", String(wi));
      const res = await fetch(`/api/retro/weekly-preview?${qs}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "erro");
        setData(null);
        return;
      }
      const parsed = body as LivePreviewResponse;
      setData(parsed);
      setWeekIndex(parsed.chart?.weekIndex ?? null);
    } catch {
      setError("network");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, target, startYear, startMonth]);

  useEffect(() => {
    void load(null);
  }, [load]);

  const entries = useMemo(() => {
    const list = data?.chart?.entries ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {t("retro.liveHeaderInfo", { month: months[month - 1], year })}{" "}
        {data ? (
          <>
            <strong style={{ color: "var(--text)" }}>{data.totalDebuts}</strong>{" "}
            {t("retro.liveDebutsSinceSuffix", { startLabel })}{" "}
            <strong style={{ color: "var(--text)" }}>{data.debutsInMonth}</strong>{" "}
            {t("retro.liveDebutsThisMonthSuffix")}
          </>
        ) : (
          t("retro.liveBuildingCurve")
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.weekLabel")}</span>
          <select
            value={weekIndex ?? ""}
            disabled={!data?.weeks.length || loading}
            onChange={(ev) => {
              const wi = Number(ev.target.value);
              setWeekIndex(wi);
              void load(wi);
            }}
            style={inputStyle}
          >
            {(data?.weeks ?? []).map((w) => (
              <option key={w.weekIndex} value={w.weekIndex}>
                {w.weekLabel} ({w.dateRange})
              </option>
            ))}
          </select>
        </label>
        <input
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder={t("retro.searchChartPlaceholder")}
          className="retro-input"
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 280, alignSelf: "flex-end" }}
        />
        <button
          onClick={() => void load(weekIndex)}
          disabled={loading}
          style={{
            ...inputStyle,
            alignSelf: "flex-end",
            padding: "10px 16px",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? t("retro.simulating") : t("retro.refreshSimulation")}
        </button>
      </div>

      {error && (
        <div style={{ ...card, borderColor: "rgba(225, 29, 72, 0.4)", background: "rgba(225, 29, 72, 0.08)", padding: "12px 16px", fontSize: 14, color: "var(--down-fg)" }}>
          {t("retro.simulateError", { error })}
        </div>
      )}

      {loading && !data && (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t("retro.simulatingWeeks")}
        </div>
      )}

      {data && !data.chart && !loading && (
        <div style={{ ...card, padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t("retro.noWeekSimulated", { startLabel })}
        </div>
      )}

      {data?.chart && (
        <div style={{ ...card, overflow: "hidden", opacity: loading ? 0.7 : 1 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--divider)", fontSize: 13 }}>
            <strong>{data.chart.weekLabel}</strong>
            <span style={{ color: "var(--text-muted)" }}> · {data.chart.dateRange} · top {data.chartSize}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>#</th>
                  <th style={{ ...thStyle, width: 48 }}>LW</th>
                  <th style={thStyle}>{t("retro.colSong")}</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>St</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>{t("retro.colWeeksAbbr")}</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>{t("retro.colPeak")}</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Power</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Score</th>
                  <th style={thStyle}>{t("retro.colDebut")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const st = STATUS_LABEL[e.status];
                  const debutMonth =
                    e.debutDate != null
                      ? `${months[Number(e.debutDate.slice(5, 7)) - 1]?.slice(0, 3) ?? ""}/${e.debutDate.slice(0, 4)}`
                      : null;
                  return (
                    <tr key={e.songId} className="retro-row" style={{ cursor: "default" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, ...num }}>{e.position}</td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", ...num }}>
                        {e.prevPos ?? <span style={{ color: "var(--text-disabled)" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Cover url={e.coverUrl} title={e.title} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{e.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
                              {e.artist}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: st.color, fontSize: 12 }}>
                        {e.status === "up" || e.status === "down"
                          ? `${st.label}${e.delta != null ? Math.abs(e.delta) : ""}`
                          : st.label}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", ...num }}>{e.weeks}</td>
                      <td style={{ ...tdStyle, textAlign: "center", ...num }}>#{e.peak}</td>
                      <td style={{ ...tdStyle, textAlign: "right", ...num }}>{e.power}</td>
                      <td style={{ ...tdStyle, textAlign: "right", ...num }}>
                        {e.scoreFinal != null ? e.scoreFinal : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-muted)" }}>
                        {debutMonth ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...tdStyle, padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                      {t("retro.noSongFound")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryGenerationPanel({
  target,
  throughYear,
  throughMonth,
  startYear,
  startMonth,
  onStartYearChange,
  onStartMonthChange,
}: {
  target: RetroTarget;
  /** Mês selecionado na tela — publica só até aqui (fluxo mês a mês). */
  throughYear: number;
  throughMonth: number;
  startYear: number;
  startMonth: number;
  onStartYearChange: (year: number) => void;
  onStartMonthChange: (month: number) => void;
}) {
  const { t } = useTranslations();
  const months = getMonths(t);
  const targetLabel = getTargetLabel(t);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [loading, setLoading] = useState<"preview" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paradas, setParadas] = useState<ParadaOption[]>([]);
  const [paradaId, setParadaId] = useState(""); // vazio = usa a parada padrão do target

  const throughLabel = monthYear(t, months, throughMonth, throughYear);
  const startLabel = monthYear(t, months, startMonth, startYear);

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

  // Trocar o mês da curadoria / início invalida o preview anterior.
  useEffect(() => {
    setPreview(null);
    setPublishResult(null);
    setError(null);
  }, [throughYear, throughMonth, target, startYear, startMonth, paradaId]);

  async function callPublish(dryRun: boolean) {
    setLoading(dryRun ? "preview" : "publish");
    setError(null);
    try {
      const res = await fetch("/api/retro/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          startYear,
          startMonth,
          throughYear,
          throughMonth,
          dryRun,
          paradaId: paradaId || undefined,
        }),
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
        <div style={{ fontSize: 15, fontWeight: 700 }}>{t("retro.publishTitle")}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {t("retro.publishDescPrefix", { throughLabel })}{" "}
          <strong style={{ color: "var(--text)" }}>{startLabel}</strong>{" "}
          {t("retro.publishDescSuffix", { throughLabel })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.publishInLabel")}</span>
          <select value={paradaId} onChange={(ev) => setParadaId(ev.target.value)} style={inputStyle}>
            <option value="">{t("retro.defaultOption", { target: targetLabel[target] })}</option>
            {paradas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.historySinceLabel")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={startMonth}
              onChange={(ev) => onStartMonthChange(Number(ev.target.value))}
              style={inputStyle}
            >
              {months.map((m, i) => {
                const mNum = i + 1;
                const disabled = startYear === throughYear && mNum > throughMonth;
                return (
                  <option key={m} value={mNum} disabled={disabled}>{m}</option>
                );
              })}
            </select>
            <select
              value={startYear}
              onChange={(ev) => onStartYearChange(Number(ev.target.value))}
              style={inputStyle}
            >
              {YEARS.slice().reverse().filter((y) => y <= throughYear).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.untilLabel")}</span>
          <div style={{ ...inputStyle, fontWeight: 600, background: "var(--fill-subtle)" }}>
            {throughLabel}
          </div>
        </div>
        <button
          onClick={() => void callPublish(true)}
          disabled={loading !== null}
          style={{ ...inputStyle, padding: "10px 16px", fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading === "preview" ? t("retro.simulating") : t("retro.simulateUntilMonth")}
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
            {loading === "publish" ? t("retro.publishing") : t("retro.publishUntil", { month: months[throughMonth - 1], year: throughYear })}
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "var(--down-fg)" }}>{t("retro.errorPrefix", { error })}</div>
      )}

      {preview && (
        <div style={{ fontSize: 13, color: "var(--text-subtle)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{preview.weeksToCreate}</strong> {t("retro.newWeeksSummarySuffix", { startLabel, throughLabel })}
            {(preview.weeksAlreadyExist ?? 0) > 0 && (
              <> {t("retro.alreadyExistSuffix", { count: preview.weeksAlreadyExist ?? 0 })}</>
            )}
            {" "}· <strong>{preview.totalDebuts}</strong>{" "}
            {t("retro.debutsSummarySuffix", { months: preview.monthsScanned })}
          </div>
          {preview.firstWeek && (
            <div>
              {t("retro.firstWeekSummary", {
                weekLabel: preview.firstWeek.weekLabel,
                dateRange: preview.firstWeek.dateRange,
                list: preview.firstWeek.top5.map((e) => `#${e.position} ${e.title}`).join(", "),
              })}
            </div>
          )}
          {preview.lastWeek && preview.lastWeek.weekIndex !== preview.firstWeek?.weekIndex && (
            <div>
              {t("retro.lastWeekSummary", {
                weekLabel: preview.lastWeek.weekLabel,
                dateRange: preview.lastWeek.dateRange,
                list: preview.lastWeek.top5.map((e) => `#${e.position} ${e.title}`).join(", "),
              })}
            </div>
          )}
          {preview.weeksToCreate === 0 && (
            <div>
              {(preview.weeksAlreadyExist ?? 0) > 0
                ? t("retro.allWeeksPublished", { count: preview.weeksAlreadyExist ?? 0, startLabel, throughLabel })
                : preview.monthsScanned === 0
                  ? t("retro.noMonthsScanned", { throughLabel })
                  : t("retro.noEligibleDebuts", { throughLabel, months: preview.monthsScanned })}
            </div>
          )}
        </div>
      )}

      {publishResult && (
        <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>
          <strong>{publishResult.created}</strong> {t("retro.publishedSummarySuffix", { skipped: publishResult.skippedExisting })}{" "}
          {publishResult.remaining > 0 ? (
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {t("retro.remainingThisMonth", { count: publishResult.remaining })}
            </span>
          ) : (
            <span>
              {t("retro.monthReady", { month: throughLabel })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── página ────────────────────────────────────────────────────────────────

export function RetroClient() {
  const { t } = useTranslations();
  const months = getMonths(t);
  const peakLabel = getPeakLabel(t);
  const confidenceLabel = getConfidenceLabel(t);
  const targetLabel = getTargetLabel(t);
  const sourceLabel = getSourceLabel(t);
  const weightRows = getWeightRows(t);
  const [year, setYear] = useState(2005);
  const [month, setMonth] = useState(5);
  const [mode, setMode] = useState<RetroMode>("retrospectivo");
  const [target, setTarget] = useState<RetroTarget>("hot100");
  const [data, setData] = useState<RetroResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialHistory = defaultHistoryStart(2005, 5);
  const [historyStartYear, setHistoryStartYear] = useState(initialHistory.year);
  const [historyStartMonth, setHistoryStartMonth] = useState(initialHistory.month);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [view, setView] = useState<RetroView>("debuts");

  // Ao mudar o mês “até”, sugere início = 1 ano antes (pode ajustar manualmente).
  useEffect(() => {
    const next = defaultHistoryStart(year, month);
    setHistoryStartYear(next.year);
    setHistoryStartMonth(next.month);
  }, [year, month]);

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
          debutSourcePreferred: draft.debutSource === "auto" ? null : draft.debutSource,
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
          <span style={labelStyle}>{t("retro.periodLabel")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={month} onChange={(ev) => setMonth(Number(ev.target.value))} style={inputStyle}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(ev) => setYear(Number(ev.target.value))} style={inputStyle}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.targetLabel")}</span>
          <select value={target} onChange={(ev) => setTarget(ev.target.value as RetroTarget)} style={inputStyle}>
            <option value="hot100">{targetLabel.hot100}</option>
            <option value="clipes">{targetLabel.clipes}</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{t("retro.modeLabel")}</span>
          <select value={mode} onChange={(ev) => setMode(ev.target.value as RetroMode)} style={inputStyle}>
            <option value="retrospectivo">{t("retro.modeRetrospectivo")}</option>
            <option value="historico">{t("retro.modeHistorico")}</option>
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
          {loading ? t("retro.calculating") : t("retro.recalculate")}
        </button>
      </div>

      {error === "no_lastfm_user" && (
        <div style={{ ...card, borderColor: "rgba(217, 119, 6, 0.4)", background: "rgba(217, 119, 6, 0.08)", padding: "12px 16px", fontSize: 14, color: "#B45309" }}>
          {t("retro.noLastfmUser")}
        </div>
      )}
      {error && error !== "no_lastfm_user" && (
        <div style={{ ...card, borderColor: "rgba(225, 29, 72, 0.4)", background: "rgba(225, 29, 72, 0.08)", padding: "12px 16px", fontSize: 14, color: "var(--down-fg)" }}>
          {t("retro.loadError", { error })}
        </div>
      )}

      {loading && !data && (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t("retro.loadingChart")}
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                { id: "debuts" as const, label: t("retro.tabDebuts") },
                { id: "live" as const, label: t("retro.tabLive") },
              ] as const
            ).map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  style={{
                    ...inputStyle,
                    padding: "8px 14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: active ? "var(--accent)" : "var(--surface)",
                    color: active ? "#fff" : "var(--text)",
                    borderColor: active ? "var(--accent)" : "var(--divider)",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {view === "live" && (
            <WeeklyLivePreview
              year={year}
              month={month}
              target={target}
              startYear={historyStartYear}
              startMonth={historyStartMonth}
            />
          )}

          {view === "debuts" && (
          <>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("retro.debutsInfo", {
              month: months[data.period.month - 1],
              year: data.period.year,
              target: targetLabel[data.period.target],
              playsInfo: data.usesRealPeriodData ? t("retro.playsRealPeriod") : t("retro.playsEstimated"),
              matched: data.stats.matched,
              unmatched: data.stats.unmatched,
            })}
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <StatTile value={data.stats.eligible} label={t("retro.statEligible")} />
            <StatTile value={data.stats.catalogOnly} label={t("retro.statCatalogOnly")} />
            <StatTile value={data.stats.withPeriodPlays} label={t("retro.statWithPeriodPlays")} />
            <StatTile value={data.stats.everInTop20} label={t("retro.statEverInTop20")} />
            <StatTile value={data.stats.everNumberOne} label={t("retro.statEverNumberOne")} />
            <StatTile value={data.stats.diamonds} label="Diamonds" />
            <StatTile value={data.stats.excludedOut} label={t("retro.statExcludedOut")} />
          </div>

          {/* Busca + ações em lote */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <input
              value={search}
              onChange={(ev) => { setSearch(ev.target.value); setPage(1); }}
              placeholder={t("retro.searchPlaceholder")}
              className="retro-input"
              style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 340 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)", ...num }}>
              {filtered.length === data.entries.length
                ? t("retro.positionsCountAll", { count: data.entries.length })
                : t("retro.positionsCountFiltered", { filtered: filtered.length, total: data.entries.length })}
            </span>

            {checked.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", ...num }}>{t("retro.selectedCount", { count: checked.size })}</span>
                <button
                  onClick={() => void bulkSetOut(true)}
                  disabled={bulkSaving}
                  style={{ ...inputStyle, padding: "6px 12px", fontWeight: 600, cursor: bulkSaving ? "default" : "pointer", opacity: bulkSaving ? 0.6 : 1 }}
                >
                  {t("retro.markAsOut")}
                </button>
                <button
                  onClick={() => void bulkSetOut(false)}
                  disabled={bulkSaving}
                  style={{ ...inputStyle, padding: "6px 12px", cursor: bulkSaving ? "default" : "pointer", opacity: bulkSaving ? 0.6 : 1 }}
                >
                  {t("retro.undoExclusion")}
                </button>
                <button
                  onClick={() => setChecked(new Set())}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                >
                  {t("retro.clearSelection")}
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
                        aria-label={t("retro.selectAllOnPage")}
                      />
                    </th>
                    <th style={{ ...thStyle, width: 40 }}>#</th>
                    <th style={thStyle}>{t("retro.colSong")}</th>
                    <th style={thStyle}>{t("retro.colDebut")}</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>{t("retro.colMonth")}</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>{t("retro.colTotal")}</th>
                    <th style={thStyle}>Single</th>
                    <th style={thStyle}>{t("retro.colClipe")}</th>
                    <th style={thStyle}>{t("retro.colAlbum")}</th>
                    <th style={{ ...thStyle, textAlign: "center" }} title={t("retro.peakTooltip")}>{t("retro.colPeak")}</th>
                    <th style={{ ...thStyle, textAlign: "center" }} title={t("retro.weeksTooltip")}>{t("retro.colWeeksAbbr")}</th>
                    <th style={{ ...thStyle, textAlign: "center" }} title={t("retro.numberOnesTooltip")}>#1s</th>
                    <th style={thStyle}>{t("retro.colImportance")}</th>
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
                          aria-label={t("retro.selectSong", { title: e.title })}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", fontWeight: 600, ...num }}>
                        {e.position ?? <span title={t("retro.markedAsOut")}>—</span>}
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
                            {sourceLabel[e.releaseRefSource]}
                            {e.debutSourcePreferred && (
                              <span title={t("retro.sourceLockedTooltip")} style={{ marginLeft: 3, color: "var(--accent)" }}>✎</span>
                            )}
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
                          <span style={badgeStyle("var(--down-fg)", "var(--down-bg)")}>{t("retro.peakOut")}</span>
                        ) : (
                          <>
                            {peakLabel[e.peakPotential]}
                            {e.peakPotentialIsManual && <span title={t("retro.manuallySetTooltip")} style={{ marginLeft: 4, fontSize: 11, color: "var(--accent)" }}>✎</span>}
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
                        {search ? t("retro.noResultsSearch") : t("retro.noResultsMonth")}
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
                  {t("retro.showingRange", { from: (safePage - 1) * PAGE_SIZE + 1, to: Math.min(safePage * PAGE_SIZE, filtered.length), total: filtered.length })}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    style={{ ...inputStyle, padding: "6px 12px", cursor: safePage <= 1 ? "default" : "pointer", opacity: safePage <= 1 ? 0.4 : 1 }}
                  >
                    {t("retro.prevPage")}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    style={{ ...inputStyle, padding: "6px 12px", cursor: safePage >= totalPages ? "default" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1 }}
                  >
                    {t("retro.nextPage")}
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          <HistoryGenerationPanel
            target={target}
            throughYear={year}
            throughMonth={month}
            startYear={historyStartYear}
            startMonth={historyStartMonth}
            onStartYearChange={setHistoryStartYear}
            onStartMonthChange={setHistoryStartMonth}
          />
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
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("retro.songDetails", { position: selected.position ?? "—" })}</div>
                <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{selected.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {selected.artist}{selected.album ? ` · ${selected.album}` : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: 4 }}
                aria-label={t("retro.close")}
              >
                ✕
              </button>
            </div>

            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
              <ScoreRing value={selected.scoreFinal} size={56} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("retro.scoreFinalLabel")}</div>
                <div style={{ fontSize: 20, fontWeight: 700, ...num }}>
                  {selected.scoreFinal.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>/ 100</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {t("retro.peakConfidence", { peak: peakLabel[selected.peakPotential], confidence: confidenceLabel[selected.confidence] })}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {t("retro.debutDateLabel", { date: fmtDate(selected.releaseRef?.slice(0, 10) ?? null) })}
                  {selected.releaseRefSource ? t("retro.debutViaSource", { source: sourceLabel[selected.releaseRefSource] }) : ""}
                </div>
              </div>
            </div>

            {/* Por que está aqui */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("retro.whyHereTitle")}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {reasonsFor(selected, t).map((r) => (
                  <li key={r} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-subtle)" }}>
                    <span style={{ color: "var(--up-fg)" }}>✔</span>{r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pesos do cálculo */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("retro.weightsTitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weightRows.map((w) => {
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
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t("retro.importanceLabel")}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={draft.impManual}
                      onChange={(ev) => setDraft({ ...draft, impManual: ev.target.checked })}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {t("retro.manualLabel")}
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
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{t("retro.autoCalculatedHint")}</div>
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
                  <option value="auto">{t("retro.automaticPeak", { peak: peakLabel[selected.peakPotential] })}</option>
                  {PEAK_ORDER.map((p) => <option key={p} value={p}>{peakLabel[p]}</option>)}
                </select>
              </div>

              {/* Qual data de estreia está certa */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("retro.debutDateTitle")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8, fontSize: 12, color: "var(--text-subtle)" }}>
                  {debutCandidates(selected, t).map((c) => (
                    <div key={c.source} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>
                        {c.label}
                        {selected.releaseRefSource === c.source ? (
                          <span style={{ marginLeft: 6, ...badgeStyle("var(--accent)", "var(--fill-subtle)"), fontWeight: 600 }}>{t("retro.sourceUsedBadge")}</span>
                        ) : null}
                      </span>
                      <span style={num}>{fmtDate(c.date)}</span>
                    </div>
                  ))}
                  {debutCandidates(selected, t).length === 0 && (
                    <span style={{ color: "var(--text-muted)" }}>{t("retro.noDebutCandidate")}</span>
                  )}
                </div>
                <select
                  value={draft.debutSource}
                  onChange={(ev) => setDraft({ ...draft, debutSource: ev.target.value as Draft["debutSource"] })}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="auto">
                    {t("retro.automaticOption")}
                    {selected.releaseRefSource && !selected.debutSourcePreferred
                      ? ` (${sourceLabel[selected.releaseRefSource]})`
                      : ""}
                  </option>
                  {debutCandidates(selected, t).map((c) => (
                    <option key={c.source} value={c.source}>
                      {c.label} ({fmtDate(c.date)})
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  {t("retro.automaticSourceHint")}
                </div>
              </div>

              {/* Override Billboard Hot 100 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("retro.billboardDebutTitle")}</div>
                {selected.songBillboardHot100DebutDate && !draft.billboardDebut && (
                  <div style={{ marginBottom: 4, fontSize: 11, color: "var(--text-muted)" }}>
                    {t("retro.importedDate", { date: fmtDate(selected.songBillboardHot100DebutDate) })}
                  </div>
                )}
                <input
                  type="date"
                  value={draft.billboardDebut}
                  onChange={(ev) => setDraft({ ...draft, billboardDebut: ev.target.value })}
                  className="retro-input"
                  style={{ ...inputStyle, width: "100%" }}
                />
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  {t("retro.billboardOverrideHint")}
                </div>
              </div>

              {/* Ajuste manual */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t("retro.manualAdjustLabel")}</span>
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
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("retro.noteLabel")}</div>
                <textarea
                  value={draft.note}
                  onChange={(ev) => setDraft({ ...draft, note: ev.target.value })}
                  rows={3}
                  placeholder={t("retro.notePlaceholder")}
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
                {saving ? t("retro.saving") : t("retro.saveAndRecalculate")}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
