"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { NotificationBell } from "./NotificationBell";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useLocale, useTranslations } from "@/hooks/useTranslations";

const THEME_CYCLE: Theme[] = ["light", "auto", "dark"];
const THEME_ICON: Record<Theme, string> = { light: "☀", auto: "⬤", dark: "☾" };

interface TopBarProps {
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export function TopBar({ isMobile = false, onMenuToggle }: TopBarProps) {
  const { status } = useSession();
  const authed = status === "authenticated";
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { t } = useTranslations();
  const themeLabel: Record<Theme, string> = {
    light: t("theme.light"),
    auto: t("theme.auto"),
    dark: t("theme.dark"),
  };

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }

  function cycleLocale() {
    const idx = LOCALES.indexOf(locale);
    setLocale(LOCALES[(idx + 1) % LOCALES.length] as Locale);
  }

  if (isMobile) {
    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--bg-topbar)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: mobileSearchOpen ? "1px solid var(--divider)" : "none",
        }}
      >
        <div style={{ padding: "12px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              aria-label="Abrir menu"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text)",
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
            </button>
          )}

          <ChartFMLogo size={28} />

          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>
            ChartFM
          </span>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={cycleLocale}
            title={LOCALE_LABELS[locale].full}
            aria-label={t("language.label")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              display: "flex",
              alignItems: "center",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            {LOCALE_LABELS[locale].short}
          </button>

          <button
            type="button"
            onClick={cycleTheme}
            title={themeLabel[theme]}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              color: "var(--text)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {THEME_ICON[theme]}
          </button>

          <button
            type="button"
            onClick={() => setMobileSearchOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              color: "var(--text)",
            }}
          >
            {mobileSearchOpen ? (
              <X size={20} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            )}
          </button>

          <NotificationBell size={20} />
        </div>

        {mobileSearchOpen && (
          <div style={{ padding: "0 16px 12px" }}>
            <SearchBar autoFocus onClose={() => setMobileSearchOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg-topbar)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "1px solid var(--divider)",
        padding: "18px 40px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, maxWidth: 420 }}>
        <SearchBar />
      </div>
      <div style={{ flex: 1 }} />
      <LanguageSwitcher />
      {!authed && (
        <Link
          href="/login"
          style={{
            color: "var(--text)",
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            border: "1px solid var(--divider-strong)",
          }}
        >
          {t("nav.signIn")}
        </Link>
      )}
      <div style={{ width: 220, flexShrink: 0 }}>
        <ThemeToggle />
      </div>
      <NotificationBell size={20} />
    </div>
  );
}
