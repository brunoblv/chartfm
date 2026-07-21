"use client";

import * as React from "react";
import Link from "next/link";
import { COVER_PALETTES, USERS_DATA } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLocale, useTranslations } from "@/hooks/useTranslations";

function formatCount(n: number, locale: string): string {
  if (n >= 1000) return `+${(n / 1000).toFixed(0)}${locale === "en" ? "k" : " mil"}`;
  return `+${n}`;
}

export function AuthShell({
  children,
  curatorCount = "+12 mil",
}: {
  children: React.ReactNode;
  curatorCount?: string;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const covers = Array.from({ length: 24 }, (_, i) => COVER_PALETTES[i % COVER_PALETTES.length]);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
        background: "#FBFBFD",
        fontFamily: "inherit",
        overflow: isMobile ? "auto" : "hidden",
        maxHeight: isMobile ? "none" : "100vh",
      }}
    >
      {!isMobile && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#0F0F12",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 56px",
            color: "white",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 14,
              padding: 24,
              transform: "rotate(-8deg) scale(1.4) translate(-6%, -8%)",
              filter: "brightness(0.55)",
            }}
          >
            {covers.map((c, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`,
                  opacity: 0.5 + (i % 5) * 0.1,
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, transparent 0%, rgba(15,15,18,0.7) 70%, rgba(15,15,18,0.95) 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <ChartFMLogo size={36} />
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em" }}>ChartFM</div>
          </div>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 480 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.75,
                marginBottom: 14,
              }}
            >
              {t("login.tagline")}
            </div>
            <h1
              style={{
                fontSize: 54,
                fontWeight: 800,
                letterSpacing: "-0.045em",
                lineHeight: 1.05,
                margin: "0 0 16px 0",
              }}
            >
              {t("login.weeklyHeadline1")}
              <br />
              {t("login.weeklyHeadline2")}
            </h1>
            <p style={{ fontSize: 16, opacity: 0.8, lineHeight: 1.55, margin: 0 }}>{t("login.weeklySubhead")}</p>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex" }}>
              {USERS_DATA.slice(0, 4).map((u, i) => (
                <div
                  key={u.id}
                  style={{ marginLeft: i === 0 ? 0 : -10, border: "2px solid #0F0F12", borderRadius: "50%" }}
                >
                  <Avatar user={u} size={32} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              <b style={{ fontWeight: 700 }}>{curatorCount}</b> {t("login.activeCurators")}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "40px 24px" : 48 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <LanguageSwitcher />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export function GoogleAuthButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "14px 18px",
        background: "#1D1D1F",
        color: "white",
        border: "none",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <span style={{ background: "white", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}>
        <GoogleLogo size={16} />
      </span>
      {label}
    </button>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 22px 0", color: "#86868B", fontSize: 12, fontWeight: 500 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
      {label}
      <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      style={{
        marginBottom: 16,
        fontSize: 12,
        color: "#b91c1c",
        lineHeight: 1.5,
        background: "rgba(250,36,60,0.08)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      {message}
    </p>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <p
      style={{
        marginBottom: 16,
        fontSize: 12,
        color: "#166534",
        lineHeight: 1.5,
        background: "rgba(6,214,160,0.12)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      {message}
    </p>
  );
}

export const authInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.1)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  marginBottom: 14,
  background: "white",
  boxSizing: "border-box",
};

export const authPrimaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  marginTop: 20,
  padding: "14px 18px",
  background: disabled ? "rgba(0,0,0,0.05)" : "#FA243C",
  color: disabled ? "#86868B" : "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  cursor: disabled ? "not-allowed" : "pointer",
});

export function AuthTermsFooter() {
  const { t } = useTranslations();
  return (
    <div style={{ marginTop: 32, fontSize: 11, color: "#86868B", textAlign: "center", lineHeight: 1.5 }}>
      {t("login.termsPrefix")}{" "}
      <Link href="/terms-of-use" style={{ color: "inherit", textDecoration: "underline" }}>
        {t("login.terms")}
      </Link>{" "}
      {t("login.and")}{" "}
      <Link href="/privacy-policy" style={{ color: "inherit", textDecoration: "underline" }}>
        {t("login.privacy")}
      </Link>
      .
    </div>
  );
}

export function useCuratorCount() {
  const { locale } = useLocale();
  const [curatorCount, setCuratorCount] = React.useState(formatCount(12000, locale));
  React.useEffect(() => {
    fetch("/api/stats/weekly-curators")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.count === "number" && d.count > 0) setCuratorCount(formatCount(d.count, locale));
      })
      .catch(() => {});
  }, [locale]);
  return curatorCount;
}
