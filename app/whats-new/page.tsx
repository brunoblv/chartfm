"use client";

import { Shell } from "@/components/layout/Shell";
import { Sparkles } from "lucide-react";
import { RELEASES, TAG_META, type ReleaseTag } from "@/lib/releases-data";

function TagBadge({ tag }: { tag: ReleaseTag }) {
  const meta = TAG_META[tag];
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
  return (
    <Shell title="O que há de novo" subtitle="Acompanhe as últimas melhorias do ChartFM">
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 48 }}>

        {RELEASES.map((release) => (
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
                    <TagBadge tag={entry.tag} />
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

        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", paddingBottom: 40 }}>
          Esta página é atualizada a cada novo lançamento.
        </p>
      </div>
    </Shell>
  );
}
