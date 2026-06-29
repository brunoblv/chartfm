"use client";

import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import { InstitutionalTitle } from "@/components/institutional/InstitutionalPrimitives";
import { getReleases, getReleaseTagMeta } from "@/lib/releases-data-i18n";
import type { ReleaseTag } from "@/lib/releases-data";
import { useTranslations } from "@/hooks/useTranslations";

function tagTimelineColors(tag: ReleaseTag) {
  switch (tag) {
    case "novo":
      return { dotColor: "var(--accent)", tagBg: "var(--new-bg)", tagFg: "var(--new-fg)" };
    case "melhoria":
      return { dotColor: "var(--up-fg)", tagBg: "var(--up-bg)", tagFg: "var(--up-fg)" };
    case "fix":
      return { dotColor: "var(--same-fg)", tagBg: "var(--same-bg)", tagFg: "var(--same-fg)" };
    case "design":
      return { dotColor: "var(--accent)", tagBg: "var(--accent-tint)", tagFg: "var(--accent)" };
  }
}

export function WhatsNewClient() {
  const { t, locale } = useTranslations();
  const releases = getReleases(locale);
  const tagMeta = getReleaseTagMeta(locale);

  const entries = releases.flatMap((release) =>
    release.entries.map((entry) => ({
      version: release.label,
      date: release.date,
      tag: entry.tag,
      tagLabel: tagMeta[entry.tag].label,
      title: entry.title,
      desc: entry.description,
      colors: tagTimelineColors(entry.tag),
    }))
  );

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("whatsNew.subtitle")}>{t("whatsNew.title")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {entries.map((entry, index) => (
          <div
            key={`${entry.date}-${entry.title}`}
            style={{
              display: "flex",
              gap: 20,
              paddingBottom: 32,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flexShrink: 0,
                width: 16,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: entry.colors.dotColor,
                  flexShrink: 0,
                  marginTop: 4,
                  border: "2px solid var(--bg)",
                }}
              />
              {index < entries.length - 1 && (
                <div style={{ width: 1, flex: 1, background: "var(--divider)", marginTop: 6 }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{entry.version}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 100,
                    background: entry.colors.tagBg,
                    color: entry.colors.tagFg,
                    letterSpacing: "0.04em",
                  }}
                >
                  {entry.tagLabel.toUpperCase()}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 8,
                  letterSpacing: "-0.02em",
                  marginTop: 0,
                }}
              >
                {entry.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.75,
                  color: "var(--text-subtle)",
                  margin: 0,
                }}
              >
                {entry.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </InstitutionalLayout>
  );
}
