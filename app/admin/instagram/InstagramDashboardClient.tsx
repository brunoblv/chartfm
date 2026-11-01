"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Clapperboard, Flag, Image as ImageIcon, Images, Info, Instagram, Loader2, RefreshCw, TrendingUp, TriangleAlert, Video } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";
import type { InstagramDashboard, IgDemographic, IgRange } from "@/lib/social/instagram-insights";
import {
  audienceInsights,
  averageOnlineByHour,
  compareAudiences,
  hourDaypart,
  milestonePlan,
  type FollowerRate,
  type Projection,
  reachByDaypart,
  reachHeatmap,
  type AudienceCompareRow,
  type AudienceInsight,
  bucketByTrait,
  captionFormat,
  daypart,
  hookStrength,
  engagementRate,
  followerVelocity,
  performanceBySlot,
  postTotals,
  rankBy,
  reconstructFollowerTotals,
  reelInsights,
  reelTotals,
  safeRatio,
  type IgMediaRow,
  type ReelInsight,
} from "@/lib/social/instagram-analytics";
import { BarChart, ChartCard, HBarList, LineChart, StatTile } from "../analytics/charts";

const RANGES: IgRange[] = [7, 14, 30, 90];
const TABS = ["growth", "milestones", "content", "reels", "insights", "posts", "audience", "timing", "reach"] as const;
type Tab = (typeof TABS)[number];
type TFn = (key: string, params?: Record<string, string | number>) => string;

// ── Formatação ───────────────────────────────────────────────────────────────

function useFormatters(locale: string) {
  return useMemo(() => {
    const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString(locale));
    const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${(v * 100).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`);
    const compact = (v: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(v);
    const ratio = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}×`);
    const seconds = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}s`);
    const hours = (h: number | null | undefined) => (h == null ? "—" : `${h.toLocaleString(locale, { maximumFractionDigits: 1 })} h`);
    const day = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
    const postDate = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
    return { int, pct, compact, ratio, seconds, hours, day, postDate };
  }, [locale]);
}

type Fmt = ReturnType<typeof useFormatters>;

function timeAgo(iso: string, locale: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  return rtf.format(-Math.round(diffMin / 60), "hour");
}

function captionTitle(caption: string, fallback: string): string {
  const line = caption.split("\n").find((l) => l.trim())?.trim();
  return line || fallback;
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const stack: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const tilesGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 };
const cardsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 12 };
const noteText: CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 };
const emptyText: CSSProperties = { fontSize: 13, color: "var(--text-muted)" };

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
  };
}

const pillGroup: CSSProperties = {
  display: "inline-flex",
  gap: 2,
  padding: 3,
  borderRadius: 999,
  background: "var(--fill-subtle)",
  overflowX: "auto",
  maxWidth: "100%",
};

// ── Peças de UI ──────────────────────────────────────────────────────────────

function Thumb({ row }: { row: IgMediaRow }) {
  const [failed, setFailed] = useState(false);
  const box: CSSProperties = { width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: "var(--fill-subtle)", objectFit: "cover" };
  if (!row.thumbnailUrl || failed) return <div style={box} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={row.thumbnailUrl} alt="" style={box} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} />;
}

function KindIcon({ kind }: { kind: IgMediaRow["kind"] }) {
  const props = { size: 12, style: { color: "var(--text-muted)", flexShrink: 0 } as CSSProperties };
  if (kind === "REEL") return <Clapperboard {...props} />;
  if (kind === "CAROUSEL") return <Images {...props} />;
  if (kind === "VIDEO") return <Video {...props} />;
  return <ImageIcon {...props} />;
}

function MediaLabel({ row, t, fmt, showDate = true }: { row: IgMediaRow; t: TFn; fmt: Fmt; showDate?: boolean }) {
  const title = captionTitle(row.caption, t("adminInstagram.untitled"));
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <Thumb row={row} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {showDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            <KindIcon kind={row.kind} />
            {fmt.postDate(row.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
  if (!row.permalink) return inner;
  return (
    <a href={row.permalink} target="_blank" rel="noreferrer" style={{ textDecoration: "none", minWidth: 0, display: "block" }}>
      {inner}
    </a>
  );
}

/** Barras horizontais com miniatura do post — o padrão de ranking usado em quase todas as abas. */
function MediaRateList({
  items,
  format,
  t,
  fmt,
  color = "var(--ch1)",
  emptyLabel,
}: {
  items: { row: IgMediaRow; value: number }[];
  format: (v: number) => string;
  t: TFn;
  fmt: Fmt;
  color?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <div style={emptyText}>{emptyLabel ?? t("adminInstagram.noData")}</div>;
  const max = Math.max(...items.map((i) => i.value), Number.EPSILON);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(({ row, value }) => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(40px, 1fr) auto", alignItems: "center", gap: 10 }}>
          <MediaLabel row={row} t={t} fmt={fmt} showDate={false} />
          <div style={{ height: 8, borderRadius: 4, background: "var(--fill-subtle)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: "100%", borderRadius: 4, background: color }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", minWidth: 52, textAlign: "right" }}>{format(value)}</span>
        </div>
      ))}
    </div>
  );
}

type Column = { key: string; label: string; value: (r: IgMediaRow) => number | null; format: (v: number | null) => string };

function SortableMediaTable({ rows, columns, t, fmt, pageSize = 10 }: { rows: IgMediaRow[]; columns: Column[]; t: TFn; fmt: Fmt; pageSize?: number }) {
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [page, setPage] = useState(0);
  const col = columns.find((c) => c.key === sortKey) ?? columns[0];
  const sorted = useMemo(() => [...rows].sort((a, b) => (col.value(b) ?? -Infinity) - (col.value(a) ?? -Infinity)), [rows, col]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  if (rows.length === 0) return <div style={emptyText}>{t("adminInstagram.noPosts")}</div>;

  const th: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "none", border: "none" };
  const td: CSSProperties = { fontSize: 13, color: "var(--text)", padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderTop: "1px solid var(--divider)" };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", cursor: "default", minWidth: 200 }}>{t("adminInstagram.colPost")}</th>
              {columns.map((c) => (
                <th key={c.key} style={{ ...th, color: c.key === col.key ? "var(--text)" : th.color }} onClick={() => { setSortKey(c.key); setPage(0); }}>
                  {c.key === col.key ? "▼ " : ""}
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, textAlign: "left", maxWidth: 260 }}>
                  <MediaLabel row={r} t={t} fmt={fmt} />
                </td>
                {columns.map((c) => (
                  <td key={c.key} style={td}>{c.format(c.value(r))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          <span>{t("adminInstagram.pageRange", { from: current * pageSize + 1, to: Math.min(sorted.length, (current + 1) * pageSize), total: sorted.length })}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" style={pagerBtn(current === 0)} disabled={current === 0} onClick={() => setPage(current - 1)}>← {t("adminInstagram.prev")}</button>
            <span>{current + 1} / {pages}</span>
            <button type="button" style={pagerBtn(current >= pages - 1)} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t("adminInstagram.next")} →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function pagerBtn(disabled: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    color: disabled ? "var(--text-disabled)" : "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
  };
}

/** Barras de saldo diário: precisa de valores negativos, que o BarChart do /admin/analytics não suporta. */
function NetBarChart({ labels, values, formatValue, height = 180 }: { labels: string[]; values: number[]; formatValue: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length === 0) return null;
  // Escala única para positivos e negativos — escalas separadas exageram dias com poucos unfollows.
  const maxPos = Math.max(...values, 0);
  const maxNeg = Math.max(...values.map((v) => -v), 0);
  const scale = height / Math.max(maxPos + maxNeg, 1);
  const zeroY = maxPos * scale;
  const n = values.length;
  const labelEvery = Math.max(1, Math.ceil(n / 4));
  return (
    <div>
      <div style={{ height: 18, fontSize: 12, color: "var(--text-subtle)", textAlign: "right" }}>
        {hover != null ? `${labels[hover]} · ${values[hover] > 0 ? "+" : ""}${formatValue(values[hover])}` : ""}
      </div>
      <svg viewBox={`0 0 ${n * 10} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={n * 10} y1={zeroY} y2={zeroY} stroke="var(--divider-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => {
          const h = Math.abs(v) * scale;
          const y = v >= 0 ? zeroY - h : zeroY;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={i * 10} y={0} width={10} height={height} fill="transparent" />
              {v !== 0 && <rect x={i * 10 + 1.5} y={y} width={7} height={Math.max(h, 0.5)} rx={1.5} fill={v > 0 ? "var(--up-fg)" : "var(--down-fg)"} opacity={hover == null || hover === i ? 1 : 0.45} />}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        {labels.map((l, i) => (i % labelEvery === 0 ? <span key={i}>{l}</span> : null))}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "up" | "down" | "same"; children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}>
      {children}
    </span>
  );
}

// ── Abas ─────────────────────────────────────────────────────────────────────

function GrowthTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const { growth, account } = data;
  const totals = reconstructFollowerTotals(account.followers, growth.dailyNet);
  const velocity = followerVelocity(account.followers, growth.dailyNet);
  const net = (growth.follows ?? 0) - (growth.unfollows ?? 0);
  const fuMax = Math.max(growth.follows ?? 0, growth.unfollows ?? 0, 1);
  const trendTone = velocity.trend === "accelerating" ? "up" : velocity.trend === "decelerating" ? "down" : "same";
  const trendIcon = velocity.trend === "accelerating" ? "▲" : velocity.trend === "decelerating" ? "▼" : "■";

  return (
    <div style={stack}>
      <div style={tilesGrid}>
        <StatTile label={t("adminInstagram.followers")} value={fmt.int(account.followers)} hint={`@${account.username ?? "—"}`} />
        <StatTile label={t("adminInstagram.reach")} value={fmt.int(growth.reach)} hint={t("adminInstagram.reachHint")} />
        <StatTile label={t("adminInstagram.views")} value={fmt.int(growth.views)} />
        <StatTile label={t("adminInstagram.profileViews")} value={fmt.int(growth.profileViews)} />
        <StatTile label={t("adminInstagram.accountsEngaged")} value={fmt.int(growth.accountsEngaged)} />
        <StatTile label={t("adminInstagram.totalInteractions")} value={fmt.int(growth.totalInteractions)} />
      </div>

      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.followersOverTime")} subtitle={t("adminInstagram.currentTotal", { total: fmt.int(account.followers) })}>
          {totals.length ? (
            <LineChart labels={totals.map((d) => fmt.day(d.date))} series={[{ name: t("adminInstagram.followers"), color: "var(--ch1)", values: totals.map((d) => d.value) }]} formatValue={fmt.int} />
          ) : (
            <div style={emptyText}>{t("adminInstagram.followerSeriesUnavailable")}</div>
          )}
          <div style={noteText}>{t("adminInstagram.followersDelayNote")}</div>
        </ChartCard>

        <ChartCard title={t("adminInstagram.netPerDay")} subtitle={t("adminInstagram.netPerDaySub")}>
          {growth.dailyNet.length ? (
            <NetBarChart labels={growth.dailyNet.map((d) => fmt.day(d.date))} values={growth.dailyNet.map((d) => d.value)} formatValue={fmt.int} />
          ) : (
            <div style={emptyText}>{t("adminInstagram.followerSeriesUnavailable")}</div>
          )}
          <div style={noteText}>{t("adminInstagram.netDelayNote")}</div>
        </ChartCard>

        <ChartCard title={t("adminInstagram.velocity")} subtitle={t("adminInstagram.velocitySub")}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
              {velocity.thisWeekPct == null ? "—" : fmt.pct(velocity.thisWeekPct / 100, 2)}
            </span>
            {velocity.trend !== "unknown" && <Badge tone={trendTone}>{trendIcon} {t(`adminInstagram.trend_${velocity.trend}`)}</Badge>}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 8 }}>
            {velocity.priorWeeksAvgPct == null
              ? t("adminInstagram.velocityNoBaseline")
              : t("adminInstagram.velocityCompare", { pct: fmt.pct(velocity.priorWeeksAvgPct / 100, 2) })}
          </div>
        </ChartCard>

        <ChartCard title={t("adminInstagram.followsVsUnfollows")} subtitle={t("adminInstagram.followsVsUnfollowsSub")}>
          {growth.follows == null ? (
            <div style={emptyText}>{t("adminInstagram.metricUnavailable")}</div>
          ) : (
            <>
              {[
                { label: t("adminInstagram.follows"), value: growth.follows ?? 0, color: "var(--up-fg)" },
                { label: t("adminInstagram.unfollows"), value: growth.unfollows ?? 0, color: "var(--down-fg)" },
              ].map((r) => (
                <div key={r.label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 56px", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>{r.label}</span>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--fill-subtle)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(1, (r.value / fuMax) * 100)}%`, height: "100%", background: r.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt.int(r.value)}</span>
                </div>
              ))}
              <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>{t("adminInstagram.netThisPeriod", { net: `${net >= 0 ? "+" : ""}${fmt.int(net)}` })}</div>
            </>
          )}
        </ChartCard>

        <ChartCard title={t("adminInstagram.contactTaps")} subtitle={t("adminInstagram.contactTapsSub")}>
          {growth.contactTaps && growth.contactTaps.some((c) => c.value > 0) ? (
            <HBarList items={growth.contactTaps.map((c) => ({ label: c.key, value: c.value }))} formatValue={fmt.int} />
          ) : (
            <div style={{ border: "1px dashed var(--divider-strong)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t("adminInstagram.noContactTaps")}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("adminInstagram.noContactTapsHint")}</div>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ContentTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const rows = data.media;
  const columns: Column[] = [
    { key: "reach", label: t("adminInstagram.colReach"), value: (r) => r.reach, format: fmt.int },
    { key: "views", label: t("adminInstagram.colViews"), value: (r) => r.views, format: fmt.int },
    { key: "likes", label: t("adminInstagram.colLikes"), value: (r) => r.likes, format: fmt.int },
    { key: "comments", label: t("adminInstagram.colComments"), value: (r) => r.comments, format: fmt.int },
    { key: "shares", label: t("adminInstagram.colShares"), value: (r) => r.shares, format: fmt.int },
    { key: "saves", label: t("adminInstagram.colSaves"), value: (r) => r.saves, format: fmt.int },
    { key: "er", label: t("adminInstagram.colEr"), value: engagementRate, format: (v) => fmt.pct(v) },
  ];
  return (
    <div style={stack}>
      <ChartCard title={t("adminInstagram.allPosts")} subtitle={t("adminInstagram.allPostsSub")}>
        <SortableMediaTable rows={rows} columns={columns} t={t} fmt={fmt} />
        <div style={noteText}>{t("adminInstagram.allPostsNote", { count: rows.length })}</div>
      </ChartCard>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.erByReach")} subtitle={t("adminInstagram.erByReachSub")}>
          <MediaRateList items={rankBy(rows, engagementRate, 5)} format={(v) => fmt.pct(v)} t={t} fmt={fmt} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.shareRate")} subtitle={t("adminInstagram.shareRateSub")}>
          <MediaRateList items={rankBy(rows, (r) => safeRatio(r.shares, r.reach), 5)} format={(v) => fmt.pct(v)} t={t} fmt={fmt} />
          <div style={noteText}>{t("adminInstagram.shareRateNote")}</div>
        </ChartCard>
        <ChartCard title={t("adminInstagram.saveRate")} subtitle={t("adminInstagram.saveRateSub")}>
          <MediaRateList items={rankBy(rows, (r) => safeRatio(r.saves, r.reach), 5)} format={(v) => fmt.pct(v)} t={t} fmt={fmt} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.underperformers")} subtitle={t("adminInstagram.underperformersSub")}>
          <MediaRateList items={rankBy(rows, engagementRate, 4, "asc")} format={(v) => `${fmt.pct(v)} ER`} t={t} fmt={fmt} color="var(--down-fg)" />
        </ChartCard>
      </div>
    </div>
  );
}

function ReelsTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const reels = data.media.filter((m) => m.kind === "REEL");
  const totals = reelTotals(reels);
  if (reels.length === 0) return <ChartCard title={t("adminInstagram.tab_reels")}><div style={emptyText}>{t("adminInstagram.noReels")}</div></ChartCard>;
  const columns: Column[] = [
    { key: "save", label: t("adminInstagram.colSaveRate"), value: (r) => safeRatio(r.saves, r.reach), format: (v) => fmt.pct(v) },
    { key: "share", label: t("adminInstagram.colShareRate"), value: (r) => safeRatio(r.shares, r.reach), format: (v) => fmt.pct(v) },
    { key: "skip", label: t("adminInstagram.colSkipRate"), value: (r) => (r.skipRate == null ? null : r.skipRate / 100), format: (v) => fmt.pct(v, 0) },
    { key: "watch", label: t("adminInstagram.colAvgWatch"), value: (r) => r.avgWatchTimeMs, format: fmt.seconds },
    { key: "views", label: t("adminInstagram.colViews"), value: (r) => r.views, format: fmt.int },
  ];
  return (
    <div style={stack}>
      <div style={tilesGrid}>
        <StatTile label={t("adminInstagram.avgWatchTime")} value={fmt.seconds(totals.avgWatchTimeMs)} hint={t("adminInstagram.bestReel", { value: fmt.seconds(totals.bestAvgWatchTimeMs) })} />
        <StatTile label={t("adminInstagram.rewatch")} value={fmt.ratio(totals.rewatchRatio)} hint={t("adminInstagram.rewatchHint")} />
        <StatTile label={t("adminInstagram.totalWatchTime")} value={fmt.hours(totals.totalWatchHours)} hint={t("adminInstagram.topReel", { value: fmt.hours(totals.topReelWatchHours) })} />
        <StatTile label={t("adminInstagram.avgSkipRate")} value={totals.avgSkipRate == null ? "—" : fmt.pct(totals.avgSkipRate / 100, 0)} hint={t("adminInstagram.skipHint")} />
      </div>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.rewatchByReel")} subtitle={t("adminInstagram.rewatchByReelSub")}>
          <MediaRateList items={rankBy(reels, (r) => safeRatio(r.views, r.reach), 6)} format={fmt.ratio} t={t} fmt={fmt} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.hookSkip")} subtitle={t("adminInstagram.hookSkipSub")}>
          <MediaRateList
            items={rankBy(reels, (r) => r.skipRate, 6, "asc")}
            format={(v) => fmt.pct(v / 100, 0)}
            t={t}
            fmt={fmt}
            emptyLabel={t("adminInstagram.skipUnavailable")}
          />
          {totals.avgSkipRate != null && <div style={noteText}>{t("adminInstagram.hookSkipNote", { pct: fmt.pct(totals.avgSkipRate / 100, 0) })}</div>}
        </ChartCard>
      </div>
      <ChartCard title={t("adminInstagram.reelRates")} subtitle={t("adminInstagram.reelRatesSub")}>
        <SortableMediaTable rows={reels} columns={columns} t={t} fmt={fmt} />
      </ChartCard>
    </div>
  );
}

function insightLabel(i: ReelInsight, t: TFn) {
  return t(`adminInstagram.trait_${i.dimension}_${i.key}`);
}

function InsightsTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const reels = data.media.filter((m) => m.kind === "REEL");
  const insights = reelInsights(reels);
  const wins = insights.filter((i) => i.kind === "win");
  const gaps = insights.filter((i) => i.kind === "gap");
  const byViews = [...reels].sort((a, b) => b.views - a.views);

  const insightCard = (i: ReelInsight, tone: "up" | "down") => (
    <div key={`${i.dimension}-${i.key}`} style={{ background: `var(--${tone}-bg)`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{insightLabel(i, t)}</div>
      <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
        {t(tone === "up" ? "adminInstagram.insightWin" : "adminInstagram.insightGap", {
          count: i.count,
          avg: fmt.compact(i.avgViews),
          other: fmt.compact(i.comparisonViews),
          mult: fmt.ratio(i.multiplier),
        })}
      </div>
    </div>
  );

  const dims: { key: "format" | "hook" | "daypart"; trait: (r: IgMediaRow) => string | null }[] = [
    { key: "format", trait: (r) => captionFormat(r.caption) },
    { key: "hook", trait: (r) => hookStrength(r.skipRate) },
    { key: "daypart", trait: (r) => daypart(r.timestamp) },
  ];

  if (reels.length < 3) return <ChartCard title={t("adminInstagram.tab_insights")}><div style={emptyText}>{t("adminInstagram.insightsNeedMore")}</div></ChartCard>;

  return (
    <div style={stack}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("adminInstagram.insightsDisclaimer", { count: reels.length })}</div>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.whatsWorking")} subtitle={t("adminInstagram.whatsWorkingSub")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{wins.length ? wins.map((i) => insightCard(i, "up")) : <div style={emptyText}>{t("adminInstagram.noPatterns")}</div>}</div>
        </ChartCard>
        <ChartCard title={t("adminInstagram.holdingBack")} subtitle={t("adminInstagram.holdingBackSub")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{gaps.length ? gaps.map((i) => insightCard(i, "down")) : <div style={emptyText}>{t("adminInstagram.noPatterns")}</div>}</div>
        </ChartCard>
      </div>
      <ChartCard title={t("adminInstagram.bestReelsCommon")} subtitle={t("adminInstagram.bestReelsCommonSub")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {dims.map((d) => {
            const buckets = bucketByTrait(reels, d.trait);
            if (buckets.length === 0) return null;
            return (
              <div key={d.key}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>{t(`adminInstagram.dim_${d.key}`)}</div>
                <HBarList
                  items={buckets.map((b) => ({ label: t(`adminInstagram.trait_${d.key}_${b.key}`), sub: `${b.count} · ${fmt.ratio(b.multiplier)}`, value: b.avgViews }))}
                  formatValue={fmt.compact}
                />
              </div>
            );
          })}
        </div>
        <div style={noteText}>{t("adminInstagram.bestReelsCommonNote")}</div>
      </ChartCard>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.topReels")}>
          <MediaRateList items={byViews.slice(0, 3).map((row) => ({ row, value: row.views }))} format={fmt.compact} t={t} fmt={fmt} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.bottomReels")}>
          <MediaRateList items={byViews.slice(-3).reverse().map((row) => ({ row, value: row.views }))} format={fmt.compact} t={t} fmt={fmt} color="var(--down-fg)" />
        </ChartCard>
      </div>
    </div>
  );
}

function PostsTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const statics = data.media.filter((m) => m.kind === "IMAGE" || m.kind === "CAROUSEL");
  const totals = postTotals(statics);
  const columns: Column[] = [
    { key: "reach", label: t("adminInstagram.colReach"), value: (r) => r.reach, format: fmt.int },
    { key: "views", label: t("adminInstagram.colViews"), value: (r) => r.views, format: fmt.int },
    { key: "er", label: t("adminInstagram.colEr"), value: engagementRate, format: (v) => fmt.pct(v) },
    { key: "follows", label: t("adminInstagram.colFollows"), value: (r) => r.follows, format: fmt.int },
    { key: "visits", label: t("adminInstagram.colVisits"), value: (r) => r.profileVisits, format: fmt.int },
    { key: "saves", label: t("adminInstagram.colSaves"), value: (r) => r.saves, format: fmt.int },
  ];
  const formats = (["CAROUSEL", "IMAGE"] as const).map((kind) => {
    const list = statics.filter((m) => m.kind === kind);
    const tt = postTotals(list);
    const avgReach = list.length ? list.reduce((a, r) => a + r.reach, 0) / list.length : null;
    return { kind, count: list.length, er: tt.avgEngagementRate, avgReach, conv: tt.followerConversion };
  });

  return (
    <div style={stack}>
      <div style={tilesGrid}>
        <StatTile label={t("adminInstagram.staticPosts")} value={fmt.int(totals.count)} hint={t("adminInstagram.inRange")} />
        <StatTile label={t("adminInstagram.avgEr")} value={fmt.pct(totals.avgEngagementRate)} hint={t("adminInstagram.erHint")} />
        <StatTile label={t("adminInstagram.followerConversion")} value={fmt.pct(totals.followerConversion, 3)} hint={t("adminInstagram.followerConversionHint", { count: fmt.int(totals.totalFollows) })} />
        <StatTile label={t("adminInstagram.profileVisitRate")} value={fmt.pct(totals.profileVisitRate)} hint={t("adminInstagram.profileVisitRateHint")} />
      </div>
      <ChartCard title={t("adminInstagram.staticPerformance")} subtitle={t("adminInstagram.staticPerformanceSub")}>
        <SortableMediaTable rows={statics} columns={columns} t={t} fmt={fmt} />
        <div style={noteText}>{t("adminInstagram.staticNote")}</div>
      </ChartCard>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.saveMagnets")} subtitle={t("adminInstagram.saveMagnetsSub")}>
          <MediaRateList items={rankBy(statics, (r) => safeRatio(r.saves, r.reach), 5)} format={(v) => fmt.pct(v)} t={t} fmt={fmt} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.followerConversion")} subtitle={t("adminInstagram.followerConversionSub")}>
          <MediaRateList items={rankBy(statics, (r) => safeRatio(r.follows, r.reach), 5)} format={(v) => fmt.pct(v, 3)} t={t} fmt={fmt} />
        </ChartCard>
      </div>
      <ChartCard title={t("adminInstagram.imageVsCarousel")} subtitle={t("adminInstagram.imageVsCarouselSub")}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420, fontSize: 13 }}>
            <thead>
              <tr>
                {[t("adminInstagram.colFormat"), t("adminInstagram.colPosts"), t("adminInstagram.colAvgEr"), t("adminInstagram.colAvgReach"), t("adminInstagram.colConversion")].map((h, i) => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", padding: "8px 10px", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formats.map((f) => (
                <tr key={f.kind}>
                  <td style={{ padding: 10, borderTop: "1px solid var(--divider)", color: "var(--text)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <KindIcon kind={f.kind} /> {t(f.kind === "CAROUSEL" ? "adminInstagram.carousels" : "adminInstagram.images")}
                    </span>
                  </td>
                  {[fmt.int(f.count), fmt.pct(f.er), fmt.int(f.avgReach), fmt.pct(f.conv, 3)].map((v, i) => (
                    <td key={i} style={{ padding: 10, borderTop: "1px solid var(--divider)", textAlign: "right", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

const AUD_KEYS = ["followers", "reached", "engaged"] as const;
const AUD_COLOR: Record<(typeof AUD_KEYS)[number], string> = { followers: "var(--ch1)", reached: "var(--ch2)", engaged: "var(--ch3)" };

function AudienceLegend({ t }: { t: TFn }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
      {AUD_KEYS.map((k) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-subtle)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: AUD_COLOR[k] }} />
          {t(`adminInstagram.aud_${k}`)}
        </span>
      ))}
    </div>
  );
}

/** Três barras finas por grupo (seguidores, alcançados, engajados) — mostra onde o alcance e o engajamento descolam da base. */
function AudienceCompare({ rows, t, fmt, labelFor, limit = 8 }: { rows: AudienceCompareRow[]; t: TFn; fmt: Fmt; labelFor?: (key: string) => string; limit?: number }) {
  if (rows.length === 0) return <div style={emptyText}>{t("adminInstagram.audienceUnavailable")}</div>;
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.flatMap((r) => AUD_KEYS.map((k) => r[k] ?? 0)), Number.EPSILON);
  return (
    <div>
      <AudienceLegend t={t} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((r) => (
          <div key={r.key} style={{ display: "grid", gridTemplateColumns: "minmax(64px, 110px) 1fr 44px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={labelFor ? labelFor(r.key) : r.key}>
              {labelFor ? labelFor(r.key) : r.key}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {AUD_KEYS.map((k) => (
                <div key={k} style={{ height: 5, borderRadius: 3, background: "var(--fill-subtle)", overflow: "hidden" }}>
                  <div style={{ width: `${((r[k] ?? 0) / max) * 100}%`, height: "100%", borderRadius: 3, background: AUD_COLOR[k] }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 11, lineHeight: "13px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {AUD_KEYS.map((k, i) => (
                <span key={k} style={{ color: i === 0 ? "var(--text)" : "var(--text-muted)", fontWeight: i === 0 ? 700 : 400 }}>{fmt.pct(r[k], 0)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightRow({ tone, children }: { tone: "up" | "warn" | "info"; children: ReactNode }) {
  const Icon = tone === "up" ? TrendingUp : tone === "warn" ? TriangleAlert : Info;
  const bg = tone === "up" ? "var(--up-bg)" : tone === "warn" ? "var(--fill-subtle)" : "transparent";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 13px", borderRadius: 12, background: bg, border: tone === "info" ? "1px solid var(--divider-strong)" : "1px solid transparent" }}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 2, color: tone === "up" ? "var(--up-fg)" : "var(--text-subtle)" }} />
      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

function AudienceTab({ data, t, fmt, locale }: { data: InstagramDashboard; t: TFn; fmt: Fmt; locale: string }) {
  const { audience } = data;
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);
  const cmp = (dim: IgDemographic) => compareAudiences(audience.followers[dim], audience.reached[dim], audience.engaged[dim]);
  const age = cmp("age").sort((a, b) => a.key.localeCompare(b.key));
  const gender = cmp("gender");
  const country = cmp("country");
  const city = cmp("city");
  const insights = audienceInsights({ age, gender, city });
  const genderLabel = (k: string) => (k === "F" ? t("adminInstagram.genderF") : k === "M" ? t("adminInstagram.genderM") : t("adminInstagram.genderU"));
  const cityLabel = (k: string) => k.split(",")[0];
  const p = (v: number) => fmt.pct(v, 0);

  const insightText = (i: AudienceInsight) => {
    switch (i.kind) {
      case "ageMostEngaged":
        return t("adminInstagram.ai_ageMostEngaged", { key: i.key, followers: p(i.followers), engaged: p(i.engaged) });
      case "ageReachNoEngage":
        return t("adminInstagram.ai_ageReachNoEngage", { key: i.key, reached: p(i.reached), engaged: p(i.engaged) });
      case "ageNewReach":
        return t("adminInstagram.ai_ageNewReach", { key: i.key, reached: p(i.reached), followers: p(i.followers), engaged: p(i.engaged) });
      case "genderSplit":
        return t(i.engaged >= i.followers ? "adminInstagram.ai_genderOver" : "adminInstagram.ai_genderUnder", { key: genderLabel(i.key), followers: p(i.followers), engaged: p(i.engaged) });
      case "cityStronghold":
        return t("adminInstagram.ai_cityStronghold", { key: cityLabel(i.key), engaged: fmt.pct(i.engaged) });
      case "cityAboveWeight":
        return t("adminInstagram.ai_cityAboveWeight", { key: cityLabel(i.key), engaged: fmt.pct(i.engaged), followers: fmt.pct(i.followers) });
    }
  };
  const toneOf = (i: AudienceInsight): "up" | "warn" | "info" =>
    i.kind === "ageMostEngaged" || i.kind === "cityStronghold" ? "up" : i.kind === "ageReachNoEngage" ? "warn" : "info";

  const genderBar = (k: (typeof AUD_KEYS)[number]) => {
    const f = gender.find((g) => g.key === "F")?.[k];
    const m = gender.find((g) => g.key === "M")?.[k];
    if (f == null || m == null) return null;
    const fm = f + m || 1;
    return (
      <div key={k} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{t(`adminInstagram.aud_${k}`)}</span>
          <span style={{ color: "var(--text-subtle)", fontVariantNumeric: "tabular-nums" }}>
            {t("adminInstagram.genderF")} <b style={{ color: "var(--text)" }}>{p(f)}</b> · {t("adminInstagram.genderM")} <b style={{ color: "var(--text)" }}>{p(m)}</b>
          </span>
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--fill-subtle)" }}>
          <div style={{ width: `${(f / fm) * 100}%`, background: "var(--ch1)" }} />
          <div style={{ width: `${(m / fm) * 100}%`, background: "var(--ch2)" }} />
        </div>
      </div>
    );
  };

  return (
    <div style={stack}>
      <ChartCard title={t("adminInstagram.audienceTells")} subtitle={t("adminInstagram.audienceTellsSub")}>
        {insights.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((i) => (
              <InsightRow key={i.kind} tone={toneOf(i)}>{insightText(i)}</InsightRow>
            ))}
          </div>
        ) : (
          <div style={emptyText}>{t("adminInstagram.audienceNoInsights")}</div>
        )}
        <div style={noteText}>{t("adminInstagram.audienceNote")}</div>
      </ChartCard>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.ageTitle")} subtitle={t("adminInstagram.ageSub")}>
          <AudienceCompare rows={age} t={t} fmt={fmt} limit={10} />
          <div style={noteText}>{t("adminInstagram.audienceLegendNote")}</div>
        </ChartCard>
        <ChartCard title={t("adminInstagram.genderTitle")} subtitle={t("adminInstagram.genderSub")}>
          {gender.length ? AUD_KEYS.map(genderBar) : <div style={emptyText}>{t("adminInstagram.audienceUnavailable")}</div>}
        </ChartCard>
        <ChartCard title={t("adminInstagram.countryTitle")} subtitle={t("adminInstagram.countrySub")}>
          <AudienceCompare rows={country} t={t} fmt={fmt} labelFor={(k) => regionNames?.of(k) ?? k} />
        </ChartCard>
        <ChartCard title={t("adminInstagram.cityTitle")} subtitle={t("adminInstagram.citySub")}>
          <AudienceCompare rows={city} t={t} fmt={fmt} labelFor={cityLabel} />
        </ChartCard>
      </div>
    </div>
  );
}

// Seg→Dom: a semana de trabalho primeiro, como no Instagram.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function TimingTab({ data, t, fmt, locale }: { data: InstagramDashboard; t: TFn; fmt: Fmt; locale: string }) {
  const online = data.onlineFollowers?.length ? averageOnlineByHour(data.onlineFollowers) : null;
  const byWeekday = performanceBySlot(data.media, "weekday");
  const parts = reachByDaypart(data.media);
  const grid = reachHeatmap(data.media);
  const weekdayName = (i: number) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + i)));
  const weekdayLong = (i: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + i)));
  const h = (n: number) => `${String(n).padStart(2, "0")}h`;
  const peakOnline = online ? online.indexOf(Math.max(...online)) : null;
  const bestWeekday = [...byWeekday].sort((a, b) => b.avgReach - a.avgReach)[0];
  const bestPart = [...parts].filter((x) => x.count > 0).sort((a, b) => b.avgReach - a.avgReach)[0];
  const heatMax = Math.max(...grid.flat().map((v) => v ?? 0), 1);
  const weekdayItems = WEEK_ORDER.map((wd) => ({ label: weekdayName(wd), value: byWeekday.find((s) => s.key === wd)?.avgReach ?? 0 }));

  return (
    <div style={stack}>
      <ChartCard title={t("adminInstagram.onlineFollowers")} subtitle={t("adminInstagram.onlineFollowersSub")}>
        {online && peakOnline != null ? (
          <>
            <InsightRow tone="info">{t("adminInstagram.onlinePeak", { part: t(`adminInstagram.part_${hourDaypart(peakOnline)}`), hour: h(peakOnline) })}</InsightRow>
            <div style={{ height: 12 }} />
            <BarChart labels={online.map((_, i) => h(i))} values={online} formatValue={fmt.int} color="var(--ch2)" />
            <div style={noteText}>{t("adminInstagram.onlineNote")}</div>
          </>
        ) : (
          <div style={emptyText}>{t("adminInstagram.onlineUnavailable")}</div>
        )}
      </ChartCard>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.reachByWeekday")} subtitle={t("adminInstagram.reachByWeekdaySub")}>
          <HBarList items={weekdayItems} formatValue={(v) => (v > 0 ? fmt.compact(v) : "—")} />
          {bestWeekday && <div style={noteText}>{t("adminInstagram.weekdayPeak", { day: weekdayLong(bestWeekday.key) })}</div>}
        </ChartCard>
        <ChartCard title={t("adminInstagram.reachByDaypart")} subtitle={t("adminInstagram.reachByDaypartSub")}>
          <HBarList items={parts.map((x) => ({ label: t(`adminInstagram.partLabel_${x.key}`), value: x.avgReach, sub: x.count ? `${x.count}` : undefined }))} formatValue={(v) => (v > 0 ? fmt.compact(v) : "—")} />
          {bestPart && <div style={noteText}>{t("adminInstagram.daypartPeak", { part: t(`adminInstagram.partLabel_${bestPart.key}`) })}</div>}
        </ChartCard>
      </div>
      <ChartCard title={t("adminInstagram.reachMap")} subtitle={t("adminInstagram.reachMapSub")}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, minmax(12px, 1fr))", gap: 2, minWidth: 360 }}>
            <span />
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>{i % 4 === 0 ? h(i) : ""}</span>
            ))}
            {WEEK_ORDER.map((wd) => (
              <Fragment key={wd}>
                <span style={{ fontSize: 11, color: "var(--text-subtle)", alignSelf: "center" }}>{weekdayName(wd)}</span>
                {grid[wd].map((v, hr) => (
                  <div
                    key={hr}
                    title={v == null ? `${weekdayName(wd)} ${h(hr)} · —` : `${weekdayName(wd)} ${h(hr)} · ${fmt.int(v)}`}
                    style={{ aspectRatio: "1 / 1.3", borderRadius: 3, background: "var(--fill-subtle)", position: "relative", overflow: "hidden" }}
                  >
                    {v != null && <div style={{ position: "absolute", inset: 0, background: "var(--ch1)", opacity: 0.2 + 0.8 * (v / heatMax) }} />}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
        <div style={noteText}>{t("adminInstagram.reachMapNote", { count: data.media.length })}</div>
      </ChartCard>
    </div>
  );
}

function Donut({ parts, center, sub }: { parts: { value: number; color: string }[]; center: string; sub: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: 190, height: 190, margin: "0 auto" }}>
      <svg viewBox="0 0 190 190" width={190} height={190} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={95} cy={95} r={r} fill="none" stroke="var(--fill-subtle)" strokeWidth={28} />
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          // 1.5px de respiro entre as fatias
          const el = <circle key={i} cx={95} cy={95} r={r} fill="none" stroke={p.color} strokeWidth={28} strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>{center}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

const PRODUCT_TYPE_KEY: Record<string, string> = { REEL: "reels", CAROUSEL_CONTAINER: "carousels", POST: "posts", STORY: "stories", AD: "ads" };

function ReachTab({ data, t, fmt }: { data: InstagramDashboard; t: TFn; fmt: Fmt }) {
  const { reach } = data;
  const nonFollowers = reach.byFollowType?.find((b) => b.key === "NON_FOLLOWER")?.value ?? 0;
  const followers = reach.byFollowType?.find((b) => b.key === "FOLLOWER")?.value ?? 0;
  const total = nonFollowers + followers;
  const nonShare = total > 0 ? nonFollowers / total : null;
  return (
    <div style={stack}>
      <div style={cardsGrid}>
        <ChartCard title={t("adminInstagram.followerVsNon")} subtitle={t("adminInstagram.followerVsNonSub")}>
          {nonShare == null ? (
            <div style={emptyText}>{t("adminInstagram.metricUnavailable")}</div>
          ) : (
            <>
              <Donut parts={[{ value: nonFollowers, color: "var(--ch1)" }, { value: followers, color: "var(--ch2)" }]} center={fmt.pct(nonShare, 0)} sub={t("adminInstagram.nonFollowers")} />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: t("adminInstagram.nonFollowersLabel"), value: nonFollowers, color: "var(--ch1)" },
                  { label: t("adminInstagram.followers"), value: followers, color: "var(--ch2)" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text-subtle)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: row.color }} />
                      {row.label}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt.int(row.value)}</span>
                  </div>
                ))}
              </div>
              <div style={noteText}>{t(nonShare >= 0.5 ? "adminInstagram.discoveryHigh" : "adminInstagram.discoveryLow", { pct: fmt.pct(nonShare) })}</div>
            </>
          )}
        </ChartCard>
        <ChartCard title={t("adminInstagram.reachByType")} subtitle={t("adminInstagram.reachByTypeSub")}>
          {reach.byProductType ? (
            <HBarList items={reach.byProductType.map((b) => ({ label: PRODUCT_TYPE_KEY[b.key] ? t(`adminInstagram.type_${PRODUCT_TYPE_KEY[b.key]}`) : b.key, value: b.value }))} formatValue={fmt.compact} />
          ) : (
            <div style={emptyText}>{t("adminInstagram.metricUnavailable")}</div>
          )}
          <div style={noteText}>{t("adminInstagram.reachByTypeNote")}</div>
        </ChartCard>
      </div>
      <ChartCard title={t("adminInstagram.dailyReach")} subtitle={t("adminInstagram.dailyReachSub")}>
        {reach.daily ? (
          <LineChart labels={reach.daily.map((d) => fmt.day(d.date))} series={[{ name: t("adminInstagram.reach"), color: "var(--ch1)", values: reach.daily.map((d) => d.value) }]} formatValue={fmt.compact} height={220} />
        ) : (
          <div style={emptyText}>{t("adminInstagram.metricUnavailable")}</div>
        )}
      </ChartCard>
    </div>
  );
}

function MilestonesTab({ data, t, fmt, locale }: { data: InstagramDashboard; t: TFn; fmt: Fmt; locale: string }) {
  const history = data.growth.followerHistory;
  const today = data.fetchedAt.slice(0, 10);
  const plan = milestonePlan(data.account.followers, history, today);
  const totals = reconstructFollowerTotals(data.account.followers, history);
  const netByDate = new Map(history.map((d) => [d.date, d.value]));
  const rows = [...totals].reverse();
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);

  const fullDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const shortDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const weekday = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const perDay = (r: FollowerRate) => (r.perDay == null ? "—" : `${r.perDay >= 0 ? "+" : ""}${r.perDay.toLocaleString(locale, { maximumFractionDigits: 1 })}`);
  const projection = (p: Projection) =>
    p == null ? <span style={{ color: "var(--text-muted)" }}>{t("adminInstagram.noProjection")}</span> : (
      <span>
        <span style={{ fontWeight: 600 }}>{fullDate(p.date)}</span>
        <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{t("adminInstagram.inDays", { count: fmt.int(p.days) })}</span>
      </span>
    );
  const goalMilestone = plan.milestones[plan.milestones.length - 1];
  const remaining = plan.goal - plan.current;
  const blockProgress = (plan.current - plan.blockStart) / (plan.goal - plan.blockStart);

  const th: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap" };
  const td: CSSProperties = { fontSize: 13, color: "var(--text)", padding: "10px", borderTop: "1px solid var(--divider)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={stack}>
      <ChartCard title={t("adminInstagram.goalTitle", { goal: fmt.int(plan.goal) })} subtitle={t("adminInstagram.goalSub")}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>{fmt.int(plan.current)}</span>
          <span style={{ fontSize: 15, color: "var(--text-muted)" }}>/ {fmt.int(plan.goal)}</span>
          <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{fmt.pct(plan.progress, 1)}</span>
        </div>
        <div style={{ position: "relative", height: 12, borderRadius: 6, background: "var(--fill-subtle)", overflow: "hidden", marginTop: 10 }}>
          <div style={{ width: `${Math.min(100, plan.progress * 100)}%`, height: "100%", borderRadius: 6, background: "var(--ch1)" }} />
          {/* marcos de mil em mil dentro do bloco atual */}
          {plan.milestones.slice(0, -1).map((m) => (
            <div key={m.target} style={{ position: "absolute", top: 0, bottom: 0, left: `${(m.target / plan.goal) * 100}%`, width: 1, background: "var(--surface)", opacity: 0.7 }} />
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 10 }}>
          {plan.blockStart > 0
            ? t("adminInstagram.goalRemainingBlock", { remaining: fmt.int(remaining), block: fmt.pct(blockProgress, 0), previous: fmt.int(plan.blockStart) })
            : t("adminInstagram.goalRemaining", { remaining: fmt.int(remaining) })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 14 }}>
          {(["week", "month"] as const).map((k) => (
            <div key={k} style={{ background: "var(--fill-subtle)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t(`adminInstagram.atPace_${k}`, { rate: perDay(plan.rates[k]) })}</div>
              <div style={{ fontSize: 14, color: "var(--text)", marginTop: 4 }}>{projection(goalMilestone.projections[k])}</div>
            </div>
          ))}
        </div>
      </ChartCard>

      <div style={tilesGrid}>
        <StatTile label={t("adminInstagram.followers")} value={fmt.int(plan.current)} />
        <StatTile label={t("adminInstagram.ratePerDay_week")} value={perDay(plan.rates.week)} hint={t("adminInstagram.rateDaysHint", { count: plan.rates.week.days })} />
        <StatTile label={t("adminInstagram.ratePerDay_month")} value={perDay(plan.rates.month)} hint={t("adminInstagram.rateDaysHint", { count: plan.rates.month.days })} />
        <StatTile label={t("adminInstagram.toGoal")} value={fmt.int(remaining)} hint={t("adminInstagram.toGoalHint", { goal: fmt.int(plan.goal) })} />
      </div>

      <ChartCard title={t("adminInstagram.milestonesTitle")} subtitle={t("adminInstagram.milestonesSub")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {plan.milestones.map((m, i) => (
            <div
              key={m.target}
              style={{
                display: "grid",
                gridTemplateColumns: "84px 1fr",
                gap: 12,
                alignItems: "start",
                padding: "10px 10px",
                borderTop: i === 0 ? "none" : "1px solid var(--divider)",
                borderRadius: m.isGoal ? 10 : 0,
                background: m.isGoal ? "var(--accent-tint)" : undefined,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 5, paddingTop: 1 }}>
                {m.isGoal && <Flag size={13} style={{ color: "var(--accent)" }} />}
                {fmt.int(m.target)}
              </span>
              {m.reached ? (
                <span>
                  <Badge tone="up">✓ {m.reachedOn ? t("adminInstagram.reachedOn", { date: fullDate(m.reachedOn) }) : t("adminInstagram.reached")}</Badge>
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--text)", minWidth: 0 }}>
                  <span style={{ color: "var(--text-subtle)", fontWeight: 600 }}>{t("adminInstagram.missing", { count: fmt.int(m.target - plan.current) })}</span>
                  {(["week", "month"] as const).map((k) => (
                    <span key={k} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-muted)", minWidth: 44 }}>{t(`adminInstagram.paceShort_${k}`)}</span>
                      {projection(m.projections[k])}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={noteText}>{t("adminInstagram.milestonesNote", { week: perDay(plan.rates.week), month: perDay(plan.rates.month) })}</div>
      </ChartCard>

      <ChartCard title={t("adminInstagram.followersByDay")} subtitle={t("adminInstagram.followersByDaySub")}>
        {rows.length === 0 ? (
          <div style={emptyText}>{t("adminInstagram.followerSeriesUnavailable")}</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>{t("adminInstagram.colDate")}</th>
                    <th style={{ ...th, textAlign: "right" }}>{t("adminInstagram.colFollowers")}</th>
                    <th style={{ ...th, textAlign: "right" }}>{t("adminInstagram.colChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(current * pageSize, (current + 1) * pageSize).map((r) => {
                    const net = netByDate.get(r.date) ?? 0;
                    return (
                      <tr key={r.date}>
                        <td style={td}>
                          {shortDate(r.date)} <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>{weekday(r.date)}</span>
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt.int(r.value)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600, color: net > 0 ? "var(--up-fg)" : net < 0 ? "var(--down-fg)" : "var(--text-muted)" }}>
                          {net > 0 ? "+" : ""}
                          {fmt.int(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                <span>{t("adminInstagram.pageRange", { from: current * pageSize + 1, to: Math.min(rows.length, (current + 1) * pageSize), total: rows.length })}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button type="button" style={pagerBtn(current === 0)} disabled={current === 0} onClick={() => setPage(current - 1)}>← {t("adminInstagram.prev")}</button>
                  <span>{current + 1} / {pages}</span>
                  <button type="button" style={pagerBtn(current >= pages - 1)} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t("adminInstagram.next")} →</button>
                </div>
              </div>
            )}
          </>
        )}
        <div style={noteText}>{t("adminInstagram.followersByDayNote")}</div>
      </ChartCard>
    </div>
  );
}

// ── Raiz ─────────────────────────────────────────────────────────────────────

export function InstagramDashboardClient() {
  const { t, locale } = useTranslations();
  const fmt = useFormatters(locale);
  const [tab, setTab] = useState<Tab>("growth");
  const [range, setRange] = useState<IgRange>(30);
  const [data, setData] = useState<InstagramDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const load = useCallback(async (r: IgRange, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/instagram/insights?range=${r}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json as InstagramDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <div className="igx" style={{ maxWidth: 1100 }}>
      <style>{`
        .igx{--ch1:#FA243C;--ch2:#007AFF;--ch3:#8E8E93;}
        [data-theme="dark"] .igx{--ch1:#FF3B5C;--ch2:#0A84FF;--ch3:#AEAEB2;}
        @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .igx{--ch1:#FF3B5C;--ch2:#0A84FF;--ch3:#AEAEB2;} }
        @keyframes igxspin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {data?.account.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.account.profilePictureUrl} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 20, background: "var(--fill-subtle)", display: "grid", placeItems: "center" }}>
              <Instagram size={18} style={{ color: "var(--text-muted)" }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{data?.account.username ? `@${data.account.username}` : t("adminInstagram.title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {data ? t("adminInstagram.updatedAgo", { ago: timeAgo(data.fetchedAt, locale), posts: fmt.int(data.account.mediaCount) }) : t("adminInstagram.tagline")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(range, true)}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw size={14} style={loading ? { animation: "igxspin 1s linear infinite" } : undefined} />
          {t("adminInstagram.refresh")}
        </button>
      </div>

      <div style={{ ...pillGroup, marginBottom: 10 }} role="tablist">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} style={pillStyle(tab === k)} onClick={() => setTab(k)}>
            {t(`adminInstagram.tab_${k}`)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.range")}</span>
        <div style={pillGroup}>
          {RANGES.map((r) => (
            <button key={r} type="button" style={pillStyle(range === r)} onClick={() => setRange(r)} disabled={loading && range === r}>
              {t("adminInstagram.days", { count: r })}
            </button>
          ))}
        </div>
      </div>

      {data && data.warnings.length > 0 && (
        <div style={{ marginBottom: 14, borderRadius: 12, background: "var(--fill-subtle)", padding: "10px 14px", fontSize: 12, color: "var(--text-subtle)" }}>
          <button type="button" onClick={() => setShowWarnings((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-subtle)", fontSize: 12, fontWeight: 600 }}>
            <TriangleAlert size={13} /> {t("adminInstagram.warnings", { count: data.warnings.length })}
          </button>
          {showWarnings && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              {data.warnings.map((w) => (
                <li key={w} style={{ wordBreak: "break-word" }}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div style={{ borderRadius: 12, background: "var(--down-bg)", color: "var(--down-fg)", padding: "12px 14px", fontSize: 13, marginBottom: 14 }}>
          {t("adminInstagram.loadError")}: {error}
        </div>
      )}

      {!data && loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, padding: "40px 0" }}>
          <Loader2 size={16} style={{ animation: "igxspin 1s linear infinite" }} /> {t("adminInstagram.loading")}
        </div>
      )}

      {data && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.15s" }}>
          {tab === "growth" && <GrowthTab data={data} t={t} fmt={fmt} />}
          {tab === "milestones" && <MilestonesTab data={data} t={t} fmt={fmt} locale={locale} />}
          {tab === "content" && <ContentTab data={data} t={t} fmt={fmt} />}
          {tab === "reels" && <ReelsTab data={data} t={t} fmt={fmt} />}
          {tab === "insights" && <InsightsTab data={data} t={t} fmt={fmt} />}
          {tab === "posts" && <PostsTab data={data} t={t} fmt={fmt} />}
          {tab === "audience" && <AudienceTab data={data} t={t} fmt={fmt} locale={locale} />}
          {tab === "timing" && <TimingTab data={data} t={t} fmt={fmt} locale={locale} />}
          {tab === "reach" && <ReachTab data={data} t={t} fmt={fmt} />}
        </div>
      )}
    </div>
  );
}
