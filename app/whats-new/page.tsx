"use client";

import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Sparkles } from "lucide-react";
import { getReleases, getReleaseTagMeta } from "@/lib/releases-data-i18n";
import type { ReleaseTag } from "@/lib/releases-data";
import { useTranslations } from "@/hooks/useTranslations";

type TabValue = "all" | ReleaseTag;

function TagBadge({ tag, locale }: { tag: ReleaseTag; locale: "pt-BR" | "en" }) {
  const meta = getReleaseTagMeta(locale)[tag];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: meta.bg,
        color: meta.color,
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

export default function NovidadesPage() {
  const { t, locale } = useTranslations();
  const releases = getReleases(locale);
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const tabs: { value: TabValue; label: string }[] = [
    { value: "all",      label: t("whatsNew.tabAll") },
    { value: "novo",     label: t("whatsNew.tabNew") },
    { value: "melhoria", label: t("whatsNew.tabImprovement") },
    { value: "fix",      label: t("whatsNew.tabFix") },
    { value: "design",   label: t("whatsNew.tabDesign") },
  ];

  const counts: Record<TabValue, number> = {
    all:      releases.reduce((s, r) => s + r.entries.length, 0),
    novo:     releases.reduce((s, r) => s + r.entries.filter(e => e.tag === "novo").length, 0),
    melhoria: releases.reduce((s, r) => s + r.entries.filter(e => e.tag === "melhoria").length, 0),
    fix:      releases.reduce((s, r) => s + r.entries.filter(e => e.tag === "fix").length, 0),
    design:   releases.reduce((s, r) => s + r.entries.filter(e => e.tag === "design").length, 0),
  };

  const filteredReleases = releases
    .map(release => ({
      ...release,
      entries: activeTab === "all" ? release.entries : release.entries.filter(e => e.tag === activeTab),
    }))
    .filter(release => release.entries.length > 0);

  return (
    <Shell title={t("whatsNew.title")} subtitle={t("whatsNew.subtitle")}>
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            borderBottom: "1px solid var(--divider)",
            paddingBottom: 0,
          }}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #FA243C" : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                  color: isActive ? "#FA243C" : "var(--text-subtle)",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "-0.01em",
                  transition: "color 0.15s, border-color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 100,
                    fontSize: 10,
                    fontWeight: 700,
                    background: isActive ? "rgba(250,36,60,0.12)" : "var(--surface-raised, rgba(128,128,128,0.1))",
                    color: isActive ? "#FA243C" : "var(--text-muted)",
                  }}
                >
                  {counts[tab.value]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Release sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {filteredReleases.map((release) => (
            <section key={release.date}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: "rgba(250,36,60,0.08)",
                    borderRadius: 100,
                    padding: "6px 14px 6px 10px",
                  }}
                >
                  <Sparkles size={14} color="#FA243C" />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#FA243C",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {release.label}
                  </span>
                </div>
                <div style={{ flex: 1, height: 1, background: "var(--divider-strong)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {release.entries.map((entry, i) => (
                  <article
                    key={i}
                    style={{
                      background: "var(--surface)",
                      borderRadius: 16,
                      border: "1px solid var(--divider)",
                      padding: "18px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text)",
                          letterSpacing: "-0.02em",
                          flex: 1,
                          minWidth: 160,
                        }}
                      >
                        {entry.title}
                      </span>
                      <TagBadge tag={entry.tag} locale={locale} />
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--text-subtle)",
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {entry.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", paddingBottom: 40 }}>
          Esta página é atualizada a cada novo lançamento.
        </p>
      </div>
    </Shell>
  );
}
