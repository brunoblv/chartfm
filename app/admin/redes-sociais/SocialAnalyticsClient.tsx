"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "@/hooks/useTranslations";
import type { SocialAnalyticsData, SocialPostMetricRow } from "@/lib/social/metrics/dashboard";
import { ChartCard, HBarList, LineChart, StatTile } from "../analytics/charts";

type PlatformFilter = "ALL" | SocialPostMetricRow["platform"];
type SortKey = "publishedAt" | "likes" | "comments" | "shares" | "saves" | "reach" | "views" | "clicks" | "engagementRate";

const sectionTitle: CSSProperties = { fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: "28px 0 4px" };
const sectionHint: CSSProperties = { fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px" };
const tilesGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 };
const cardsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 };
const th: CSSProperties = { textAlign: "right", padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", borderBottom: "1px solid var(--divider)" };
const td: CSSProperties = { textAlign: "right", padding: "8px 10px", fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", borderBottom: "1px solid var(--divider)", fontVariantNumeric: "tabular-nums" };

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    border: `1px solid ${active ? "var(--accent)" : "var(--divider)"}`,
    background: active ? "var(--accent-tint)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text)",
    cursor: "pointer",
    textDecoration: "none",
  };
}

const buttonStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  textDecoration: "none",
};

/** Série diária com o último valor conhecido repetido nos dias sem coleta (evita "quedas" falsas a zero). */
function dailySeries(dates: string[], rows: { date: string; value: number | null }[]): number[] {
  const byDate = new Map(rows.filter((r) => r.value !== null).map((r) => [r.date, r.value as number]));
  let last = 0;
  return dates.map((d) => {
    const v = byDate.get(d);
    if (v !== undefined) last = v;
    return last;
  });
}

export function SocialAnalyticsClient({ data, periods }: { data: SocialAnalyticsData; periods: number[] }) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [filter, setFilter] = useState<PlatformFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "publishedAt", desc: true });
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fmtInt = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString(locale));
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
  const platformLabel = (p: string) => t(`socialAnalytics.platform${p}`);

  async function collectNow() {
    setCollecting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/social/metrics/collect", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setMessage(t("socialAnalytics.collectDone", { updated: json.updated, failed: json.failed }));
      router.refresh();
    } catch (err) {
      setMessage(t("socialAnalytics.collectError", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setCollecting(false);
    }
  }

  const platforms = useMemo(() => [...new Set(data.posts.map((p) => p.platform))], [data.posts]);
  const visiblePosts = useMemo(() => {
    const rows = filter === "ALL" ? data.posts : data.posts.filter((p) => p.platform === filter);
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av < bv ? -dir : dir;
    });
  }, [data.posts, filter, sort]);

  const accountDates = useMemo(() => [...new Set(data.accounts.map((a) => a.date))].sort(), [data.accounts]);
  const accountPlatforms = (["INSTAGRAM", "FACEBOOK"] as const).filter((p) => data.accounts.some((a) => a.platform === p && !a.error));
  const accountColors = { INSTAGRAM: "var(--ch1)", FACEBOOK: "var(--ch2)" } as const;

  const errors = useMemo(() => {
    const seen = new Map<string, { platform: string; error: string; count: number }>();
    for (const a of data.accounts) {
      if (a.error && a.date === accountDates[accountDates.length - 1]) seen.set(`${a.platform}:${a.error}`, { platform: a.platform, error: a.error, count: 1 });
    }
    for (const p of data.posts) {
      if (!p.error) continue;
      const key = `${p.platform}:${p.error}`;
      const cur = seen.get(key);
      if (cur) cur.count++;
      else seen.set(key, { platform: p.platform, error: p.error, count: 1 });
    }
    return [...seen.values()];
  }, [data.accounts, data.posts, accountDates]);

  const topByReach = [...data.posts]
    .filter((p) => p.reach !== null && p.reach > 0)
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 8);

  const sortHeader = (key: SortKey, label: string) => (
    <th style={{ ...th, cursor: "pointer" }} onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}>
      {label}
      {sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="sanx" style={{ maxWidth: 1200 }}>
      <style>{`
        .sanx{--ch1:#E1306C;--ch2:#1877F2;}
        [data-theme="dark"] .sanx{--ch1:#FF5C93;--ch2:#4B9BFF;}
        @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .sanx{--ch1:#FF5C93;--ch2:#4B9BFF;} }
        .sanx tbody tr:hover td{background:var(--fill-subtle);}
      `}</style>

      {/* ── Barra de ações ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 4 }}>{t("socialAnalytics.period")}:</span>
        {periods.map((d) => (
          <Link key={d} href={`?days=${d}`} style={pillStyle(d === data.days)}>
            {t("socialAnalytics.periodDays", { count: d })}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <a href={`/api/admin/social/metrics/export?days=${data.days}`} style={buttonStyle}>
          {t("socialAnalytics.exportCsv")}
        </a>
        <button type="button" onClick={collectNow} disabled={collecting} style={{ ...buttonStyle, opacity: collecting ? 0.6 : 1 }}>
          {collecting ? t("socialAnalytics.collecting") : t("socialAnalytics.collectNow")}
        </button>
      </div>
      <p style={{ ...sectionHint, marginTop: 10 }}>
        {data.lastCollectedAt ? t("socialAnalytics.lastCollected", { date: fmtDate(data.lastCollectedAt) }) : t("socialAnalytics.neverCollected")}
        {data.pendingCollection > 0 && ` · ${t("socialAnalytics.pendingCollection", { count: data.pendingCollection })}`}
        {message && <strong style={{ color: "var(--text)", marginLeft: 8 }}>{message}</strong>}
      </p>

      {/* ── Problemas ── */}
      {errors.length > 0 && (
        <div style={{ border: "1px solid var(--accent)", background: "var(--accent-tint)", borderRadius: 14, padding: "12px 16px", marginTop: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("socialAnalytics.errorsTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>{t("socialAnalytics.errorsHint")}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {errors.map((e) => (
              <li key={`${e.platform}:${e.error}`} style={{ fontSize: 13, color: "var(--text)", wordBreak: "break-word" }}>
                <strong>{platformLabel(e.platform)}</strong> ({e.count}×): {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Contas ── */}
      <h2 style={sectionTitle}>{t("socialAnalytics.accountTitle")}</h2>
      <p style={sectionHint}>{t("socialAnalytics.accountHint")}</p>
      {accountPlatforms.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("socialAnalytics.noAccountData")}</div>
      ) : (
        <>
          <div style={tilesGrid}>
            {accountPlatforms.map((platform) => {
              const rows = data.accounts.filter((a) => a.platform === platform && a.followers !== null);
              const latest = rows[rows.length - 1];
              const first = rows[0];
              const delta = latest && first ? (latest.followers ?? 0) - (first.followers ?? 0) : 0;
              return (
                <StatTile
                  key={platform}
                  label={`${t("socialAnalytics.followers")} · ${platformLabel(platform)}`}
                  value={fmtInt(latest?.followers ?? null)}
                  hint={t("socialAnalytics.followersHint", { delta: `${delta >= 0 ? "+" : ""}${fmtInt(delta)}` })}
                />
              );
            })}
          </div>
          <div style={{ ...cardsGrid, marginTop: 12 }}>
            <ChartCard title={t("socialAnalytics.followersOverTime")}>
              <LineChart
                labels={accountDates.map((d) => d.slice(5))}
                series={accountPlatforms.map((p) => ({
                  name: platformLabel(p),
                  color: accountColors[p],
                  values: dailySeries(accountDates, data.accounts.filter((a) => a.platform === p).map((a) => ({ date: a.date, value: a.followers }))),
                }))}
                formatValue={(v) => fmtInt(v)}
              />
            </ChartCard>
            <ChartCard title={t("socialAnalytics.reachOverTime")}>
              <LineChart
                labels={accountDates.map((d) => d.slice(5))}
                series={accountPlatforms.map((p) => ({
                  name: platformLabel(p),
                  color: accountColors[p],
                  values: dailySeries(accountDates, data.accounts.filter((a) => a.platform === p).map((a) => ({ date: a.date, value: a.reach }))),
                }))}
                formatValue={(v) => fmtInt(v)}
              />
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Postagens ── */}
      <h2 style={sectionTitle}>{t("socialAnalytics.postsTitle")}</h2>
      <p style={sectionHint}>{t("socialAnalytics.postsHint")}</p>
      {data.totals.length > 0 && (
        <div style={tilesGrid}>
          {data.totals.map((tot) => (
            <StatTile
              key={tot.platform}
              label={platformLabel(tot.platform)}
              value={`${fmtInt(tot.posts)} ${t("socialAnalytics.totalsPosts").toLowerCase()}`}
              hint={[
                t("socialAnalytics.totalsWithData", { count: tot.withData }),
                `${t("socialAnalytics.totalsReach")}: ${fmtInt(tot.reach)}`,
                `${t("socialAnalytics.totalsInteractions")}: ${fmtInt(tot.likes + tot.comments + tot.shares + tot.saves)}`,
                tot.avgEngagementRate !== null ? `${t("socialAnalytics.totalsEngagement")}: ${tot.avgEngagementRate}%` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}

      {topByReach.length > 0 && (
        <div style={{ ...cardsGrid, marginTop: 12 }}>
          <ChartCard title={t("socialAnalytics.topByReach")}>
            <HBarList
              items={topByReach.map((p) => ({
                label: `${fmtDate(p.publishedAt)} · ${p.eventType}`,
                sub: platformLabel(p.platform),
                value: p.reach ?? 0,
              }))}
              formatValue={(v) => fmtInt(v)}
            />
          </ChartCard>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 10px" }}>
        {(["ALL", ...platforms] as PlatformFilter[]).map((p) => (
          <button key={p} type="button" onClick={() => setFilter(p)} style={pillStyle(filter === p)}>
            {p === "ALL" ? t("socialAnalytics.filterAll") : platformLabel(p)}
          </button>
        ))}
      </div>

      {visiblePosts.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("socialAnalytics.noPosts")}</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--divider)", borderRadius: 14, background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {sortHeader("publishedAt", t("socialAnalytics.colDate"))}
                <th style={{ ...th, textAlign: "left" }}>{t("socialAnalytics.colPlatform")}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("socialAnalytics.colType")}</th>
                {sortHeader("likes", t("socialAnalytics.colLikes"))}
                {sortHeader("comments", t("socialAnalytics.colComments"))}
                {sortHeader("shares", t("socialAnalytics.colShares"))}
                {sortHeader("saves", t("socialAnalytics.colSaves"))}
                {sortHeader("reach", t("socialAnalytics.colReach"))}
                {sortHeader("views", t("socialAnalytics.colViews"))}
                {sortHeader("clicks", t("socialAnalytics.colClicks"))}
                {sortHeader("engagementRate", t("socialAnalytics.colEngagement"))}
                <th style={th}>{t("socialAnalytics.colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePosts.map((p) => (
                <tr key={`${p.postId}:${p.platform}`} title={p.caption ?? undefined}>
                  <td style={td}>{fmtDate(p.publishedAt)}</td>
                  <td style={{ ...td, textAlign: "left" }}>
                    {platformLabel(p.platform)}
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: "var(--accent)", fontSize: 12 }}>
                        {t("socialAnalytics.open")} ↗
                      </a>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>{p.eventType}</td>
                  <td style={td}>{fmtInt(p.likes)}</td>
                  <td style={td}>{fmtInt(p.comments)}</td>
                  <td style={td}>{fmtInt(p.shares)}</td>
                  <td style={td}>{fmtInt(p.saves)}</td>
                  <td style={td}>{fmtInt(p.reach)}</td>
                  <td style={td}>{fmtInt(p.views ?? p.impressions)}</td>
                  <td style={td}>{fmtInt(p.clicks)}</td>
                  <td style={td}>{p.engagementRate === null ? "—" : `${p.engagementRate}%`}</td>
                  <td style={{ ...td, color: p.error ? "var(--accent)" : "var(--text-muted)", fontSize: 12 }} title={p.error ?? undefined}>
                    {p.fetchedAt ? fmtDate(p.fetchedAt) : t("socialAnalytics.notCollected")}
                    {p.error ? " ⚠" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
