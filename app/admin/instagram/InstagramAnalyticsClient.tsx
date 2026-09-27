"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Image as ImageIcon, Layers, Play, Video } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";
import { IG_RANGE_OPTIONS, type IgMediaKind } from "@/lib/instagram-analytics/compute";
import type { IgPostRow, InstagramAnalytics } from "@/lib/instagram-analytics/service";
import { FollowerLineChart, SignedBarChart } from "./charts";

type Tab = "followers" | "posts";
type SortKey = "timestamp" | "reach" | "views" | "likes" | "comments" | "shares" | "saves" | "engagementRatePct";

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 18,
  padding: "18px 20px",
  minWidth: 0,
};

const note: CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", margin: "14px 0 0" };

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section style={card}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
      {subtitle && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{subtitle}</div>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function SectionError({ message }: { message: string }) {
  const { t } = useTranslations();
  return (
    <div style={{ fontSize: 13, color: "var(--ig-neg)", padding: "10px 12px", borderRadius: 10, background: "var(--fill-subtle)" }}>
      {t("adminInstagram.sectionError", { message })}
    </div>
  );
}

function KindIcon({ kind }: { kind: IgMediaKind }) {
  const props = { size: 14, style: { color: "var(--text-muted)", flexShrink: 0 } as CSSProperties };
  if (kind === "REEL") return <Play {...props} />;
  if (kind === "CAROUSEL") return <Layers {...props} />;
  if (kind === "VIDEO") return <Video {...props} />;
  return <ImageIcon {...props} />;
}

function Thumb({ post, size }: { post: IgPostRow; size: number }) {
  const style: CSSProperties = { width: size, height: size * 1.1, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "var(--fill-subtle)" };
  // eslint-disable-next-line @next/next/no-img-element
  return post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" style={style} /> : <div style={style} />;
}

export default function InstagramAnalyticsClient({ data, initialTab }: { data: InstagramAnalytics; initialTab: Tab }) {
  const { t, locale } = useTranslations();
  const [tab, setTab] = useState<Tab>(initialTab);
  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR"), [locale]);
  const pf = (v: number, digits = 1) =>
    `${v.toLocaleString(locale === "en" ? "en-US" : "pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  const dayLabel = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
  const errorFor = (section: InstagramAnalytics["errors"][number]["section"]) => data.errors.find((e) => e.section === section)?.message;

  function switchTab(next: Tab) {
    setTab(next);
    // Só reflete na URL (sem refetch) para o link do período manter a aba.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  const styleVars = `
    .igx{--ig-line:#1D1D1F;--ig-pos:#1F7A3D;--ig-neg:#D70015;--ig-accent:#1D1D1F;--ig-badge-bg:rgba(31,122,61,0.12);--ig-badge-neg-bg:rgba(215,0,21,0.10);}
    [data-theme="dark"] .igx{--ig-line:#F5F5F7;--ig-pos:#30D158;--ig-neg:#FF6961;--ig-accent:#F5F5F7;--ig-badge-bg:rgba(48,209,88,0.18);--ig-badge-neg-bg:rgba(255,105,97,0.18);}
    @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .igx{--ig-line:#F5F5F7;--ig-pos:#30D158;--ig-neg:#FF6961;--ig-accent:#F5F5F7;--ig-badge-bg:rgba(48,209,88,0.18);--ig-badge-neg-bg:rgba(255,105,97,0.18);} }
    .igx-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--fill-subtle);}
    .igx-seg a,.igx-seg button{border:0;background:transparent;color:var(--text-muted);font:inherit;font-size:14px;padding:7px 14px;border-radius:9px;cursor:pointer;text-decoration:none;white-space:nowrap;}
    .igx-seg .on{background:var(--surface);color:var(--text);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.12);}
    .igx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;}
    @media (max-width:420px){ .igx-grid{grid-template-columns:1fr;} }
    .igx-table th{cursor:pointer;user-select:none;}
    .igx-table tbody tr:hover{background:var(--fill-subtle);}
  `;

  if (!data.configured) {
    return (
      <div className="igx">
        <style>{styleVars}</style>
        <div style={{ ...card, color: "var(--text-muted)" }}>{t("adminInstagram.notConfigured")}</div>
      </div>
    );
  }

  return (
    <div className="igx" style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{styleVars}</style>

      {/* Cabeçalho: conta + abas + período */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {data.profilePictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.profilePictureUrl} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{data.username ? `@${data.username}` : "Instagram"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {data.followersCount != null && t("adminInstagram.followersNow", { count: nf.format(data.followersCount) })}
              {data.mediaCount != null && ` · ${t("adminInstagram.postsCount", { count: nf.format(data.mediaCount) })}`}
            </div>
          </div>
        </div>
        <div className="igx-seg" role="tablist">
          {(["followers", "posts"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => switchTab(k)}>
              {t(k === "followers" ? "adminInstagram.tabFollowers" : "adminInstagram.tabPosts")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, overflowX: "auto" }}>
        <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("adminInstagram.range")}</span>
        <div className="igx-seg">
          {IG_RANGE_OPTIONS.map((r) => (
            <Link key={r} href={`?range=${r}&tab=${tab}`} className={data.rangeDays === r ? "on" : ""} scroll={false}>
              {t("adminInstagram.rangeDays", { count: r })}
            </Link>
          ))}
        </div>
      </div>

      {tab === "followers" ? <FollowersTab data={data} t={t} nf={nf} pf={pf} dayLabel={dayLabel} errorFor={errorFor} /> : <PostsTab data={data} t={t} nf={nf} pf={pf} dayLabel={dayLabel} errorFor={errorFor} />}

      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {t("adminInstagram.updatedAt", { time: new Date(data.fetchedAt).toLocaleString(locale === "en" ? "en-US" : "pt-BR") })}
      </div>
    </div>
  );
}

type TabProps = {
  data: InstagramAnalytics;
  t: (key: string, params?: Record<string, string | number>) => string;
  nf: Intl.NumberFormat;
  pf: (v: number, digits?: number) => string;
  dayLabel: (day: string) => string;
  errorFor: (section: InstagramAnalytics["errors"][number]["section"]) => string | undefined;
};

function FollowersTab({ data, t, nf, pf, dayLabel, errorFor }: TabProps) {
  const series = data.followerSeries;
  const labels = series.map((p) => dayLabel(p.day));
  const followersErr = errorFor("followers") ?? errorFor("account");
  const v = data.velocity;
  const net = data.follows != null && data.unfollows != null ? data.follows - data.unfollows : null;
  const followMax = Math.max(data.follows ?? 0, data.unfollows ?? 0, 1);

  const trendStyle: CSSProperties =
    v?.trend === "decelerating"
      ? { color: "var(--ig-neg)", background: "var(--ig-badge-neg-bg)" }
      : v?.trend === "accelerating"
        ? { color: "var(--ig-pos)", background: "var(--ig-badge-bg)" }
        : { color: "var(--text-muted)", background: "var(--fill-subtle)" };
  const trendLabel = v ? t(`adminInstagram.trend${v.trend[0].toUpperCase()}${v.trend.slice(1)}`) : "";
  const trendArrow = v?.trend === "accelerating" ? "▲" : v?.trend === "decelerating" ? "▼" : "●";

  return (
    <div className="igx-grid">
      <Card
        title={t("adminInstagram.totalTitle")}
        subtitle={data.followersCount != null ? t("adminInstagram.totalSubtitle", { count: nf.format(data.followersCount) }) : undefined}
      >
        {series.length > 0 ? (
          <FollowerLineChart labels={labels} values={series.map((p) => p.total ?? 0)} fmt={(n) => nf.format(Math.round(n))} />
        ) : followersErr ? (
          <SectionError message={followersErr} />
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.noData")}</div>
        )}
        <p style={note}>{t("adminInstagram.totalNote")}</p>
      </Card>

      <Card title={t("adminInstagram.netTitle")} subtitle={t("adminInstagram.netSubtitle")}>
        {series.length > 0 ? (
          <SignedBarChart labels={labels} values={series.map((p) => p.net)} fmt={(n) => nf.format(Math.round(n))} />
        ) : followersErr ? (
          <SectionError message={followersErr} />
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.noData")}</div>
        )}
        <p style={note}>{t("adminInstagram.netNote")}</p>
      </Card>

      <Card title={t("adminInstagram.velocityTitle")} subtitle={t("adminInstagram.velocitySubtitle")}>
        {v ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1.1 }}>{pf(v.thisWeekPct, 2)}</span>
              <span style={{ ...trendStyle, fontSize: 14, fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>
                {trendArrow} {trendLabel}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
              {v.priorAvgPct != null ? t("adminInstagram.velocityCompare", { pct: pf(v.priorAvgPct, 2) }) : t("adminInstagram.velocityNoPrior")}
            </div>
          </>
        ) : followersErr ? (
          <SectionError message={followersErr} />
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.velocityNeedWeek")}</div>
        )}
      </Card>

      <Card title={t("adminInstagram.followsTitle")} subtitle={t("adminInstagram.followsSubtitle")}>
        {errorFor("follows") ? (
          <SectionError message={errorFor("follows")!} />
        ) : (
          <>
            {[
              { label: t("adminInstagram.follows"), value: data.follows ?? 0, color: "var(--ig-pos)" },
              { label: t("adminInstagram.unfollows"), value: data.unfollows ?? 0, color: "var(--ig-neg)" },
            ].map((row) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 56px", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{row.label}</span>
                <div style={{ height: 10, borderRadius: 5, background: "var(--fill-subtle)", overflow: "hidden" }}>
                  <div style={{ width: `${(row.value / followMax) * 100}%`, minWidth: row.value > 0 ? 6 : 0, height: "100%", borderRadius: 5, background: row.color }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{nf.format(row.value)}</span>
              </div>
            ))}
            {net != null && (
              <p style={{ ...note, marginTop: 4 }}>{t("adminInstagram.netPeriod", { value: `${net >= 0 ? "+" : ""}${nf.format(net)}` })}</p>
            )}
          </>
        )}
      </Card>

      <Card title={t("adminInstagram.contactTitle")} subtitle={t("adminInstagram.contactSubtitle")}>
        {errorFor("contact") ? (
          <SectionError message={errorFor("contact")!} />
        ) : data.contactTaps && data.contactTaps.length > 0 ? (
          <RateBars
            items={data.contactTaps.map((c) => ({ key: c.type, label: c.type.replace(/_/g, " ").toLowerCase(), value: c.value }))}
            format={(n) => nf.format(n)}
          />
        ) : (
          <div style={{ border: "1.5px dashed var(--divider-strong)", borderRadius: 12, padding: "24px 18px", textAlign: "center" }}>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{t("adminInstagram.contactEmptyTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>{t("adminInstagram.contactEmptyBody")}</div>
          </div>
        )}
        <p style={note}>{t("adminInstagram.contactNote")}</p>
      </Card>
    </div>
  );
}

function RateBars({
  items,
  format,
}: {
  items: { key: string; label: string; value: number; post?: IgPostRow }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {item.post && <Thumb post={item.post} size={36} />}
          <div style={{ display: "flex", alignItems: "center", gap: 5, width: 130, flexShrink: 0, minWidth: 0 }}>
            {item.post && <KindIcon kind={item.post.kind} />}
            <span style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: item.post ? "none" : "capitalize" }}>
              {item.label}
            </span>
          </div>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--fill-subtle)", overflow: "hidden", minWidth: 40 }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: "100%", borderRadius: 5, background: "var(--ig-accent)" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {format(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PostsTab({ data, t, nf, pf, dayLabel, errorFor }: TabProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "reach", desc: true });
  const postsErr = errorFor("posts");

  const sorted = useMemo(() => {
    const val = (p: IgPostRow): number => (sort.key === "timestamp" ? new Date(p.timestamp).getTime() : (p[sort.key] ?? -Infinity));
    return [...data.posts].sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [data.posts, sort]);

  const top = (key: "engagementRatePct" | "shareRatePct") =>
    data.posts
      .filter((p) => p[key] != null)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, 5)
      .map((p) => ({ key: p.id, label: p.caption || t(`adminInstagram.kind${p.kind}`), value: p[key] ?? 0, post: p }));

  const cols: { key: SortKey; label: string; format: (p: IgPostRow) => string }[] = [
    { key: "reach", label: t("adminInstagram.colReach"), format: (p) => (p.reach != null ? nf.format(p.reach) : "—") },
    { key: "views", label: t("adminInstagram.colViews"), format: (p) => (p.views != null ? nf.format(p.views) : "—") },
    { key: "likes", label: t("adminInstagram.colLikes"), format: (p) => (p.likes != null ? nf.format(p.likes) : "—") },
    { key: "comments", label: t("adminInstagram.colComments"), format: (p) => (p.comments != null ? nf.format(p.comments) : "—") },
    { key: "shares", label: t("adminInstagram.colShares"), format: (p) => (p.shares != null ? nf.format(p.shares) : "—") },
    { key: "saves", label: t("adminInstagram.colSaves"), format: (p) => (p.saves != null ? nf.format(p.saves) : "—") },
    { key: "engagementRatePct", label: t("adminInstagram.colEngagement"), format: (p) => (p.engagementRatePct != null ? pf(p.engagementRatePct) : "—") },
  ];

  const th: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
    padding: "10px 10px",
    borderBottom: "1px solid var(--divider-strong)",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const td: CSSProperties = { padding: "10px 10px", borderBottom: "1px solid var(--divider)", textAlign: "right", fontSize: 14, color: "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const arrow = (k: SortKey) => (sort.key === k ? (sort.desc ? "▼ " : "▲ ") : "");
  const toggle = (k: SortKey) => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true }));

  if (postsErr) {
    return (
      <Card title={t("adminInstagram.allPostsTitle")}>
        <SectionError message={postsErr} />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title={t("adminInstagram.allPostsTitle")} subtitle={t("adminInstagram.allPostsSubtitle")}>
        {sorted.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.noPosts")}</div>
        ) : (
          <div style={{ overflowX: "auto", margin: "0 -4px" }}>
            <table className="igx-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }} onClick={() => toggle("timestamp")}>
                    {arrow("timestamp")}
                    {t("adminInstagram.colPost")}
                  </th>
                  {cols.map((c) => (
                    <th key={c.key} style={{ ...th, color: sort.key === c.key ? "var(--text)" : th.color }} onClick={() => toggle(c.key)}>
                      {arrow(c.key)}
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...td, textAlign: "left", maxWidth: 280 }}>
                      <a href={p.permalink ?? undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, color: "inherit", textDecoration: "none", minWidth: 0 }}>
                        <Thumb post={p} size={44} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {p.caption || t(`adminInstagram.kind${p.kind}`)}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                            <KindIcon kind={p.kind} />
                            {dayLabel(p.timestamp.slice(0, 10))}
                          </span>
                        </span>
                      </a>
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} style={td}>
                        {c.format(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="igx-grid">
        <Card title={t("adminInstagram.engagementTitle")} subtitle={t("adminInstagram.engagementSubtitle")}>
          {top("engagementRatePct").length ? (
            <RateBars items={top("engagementRatePct")} format={(v) => pf(v)} />
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.noData")}</div>
          )}
        </Card>
        <Card title={t("adminInstagram.viralityTitle")} subtitle={t("adminInstagram.viralitySubtitle")}>
          {top("shareRatePct").length ? (
            <RateBars items={top("shareRatePct")} format={(v) => pf(v)} />
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("adminInstagram.noData")}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
