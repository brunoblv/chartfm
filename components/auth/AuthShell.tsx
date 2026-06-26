"use client";

import * as React from "react";
import Link from "next/link";
import { COVER_PALETTES, USERS_DATA } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "@/hooks/useTranslations";

function formatCount(n: number): string {
  if (n >= 1000) return `+${(n / 1000).toFixed(0)} mil`;
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
  const [curatorCount, setCuratorCount] = React.useState("+12 mil");
  React.useEffect(() => {
    fetch("/api/stats/weekly-curators")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.count === "number" && d.count > 0) setCuratorCount(formatCount(d.count));
      })
      .catch(() => {});
  }, []);
  return curatorCount;
}
