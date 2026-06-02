"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/hooks/useTranslations";

type Variant = "compact" | "settings";

export function LanguageSwitcher({ variant = "compact" }: { variant?: Variant }) {
  const { locale, setLocale } = useLocale();

  if (variant === "settings") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {LOCALES.map((loc) => {
            const active = locale === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: active ? "2px solid var(--accent)" : "1px solid var(--divider-strong)",
                  background: active ? "var(--accent-tint)" : "var(--surface)",
                  color: active ? "var(--accent)" : "var(--text)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {LOCALE_LABELS[loc].full}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 8,
        background: "var(--fill-subtle)",
        border: "1px solid var(--divider)",
      }}
    >
      <Languages size={14} color="var(--text-muted)" style={{ marginLeft: 6, flexShrink: 0 }} />
      {LOCALES.map((loc) => (
        <LocaleButton key={loc} loc={loc} active={locale === loc} onSelect={setLocale} />
      ))}
    </div>
  );
}

function LocaleButton({
  loc,
  active,
  onSelect,
}: {
  loc: Locale;
  active: boolean;
  onSelect: (loc: Locale) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(loc)}
      aria-pressed={active}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        border: "none",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 11,
        fontWeight: active ? 700 : 600,
        cursor: "pointer",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {LOCALE_LABELS[loc].short}
    </button>
  );
}
