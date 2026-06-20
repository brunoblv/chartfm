"use client";

import Link from "next/link";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";

interface GlobalHeroProps {
  weekNow: string;
  weekRangeNow: string;
  songsCount: number;
  olderWeek: number | null;
  newerWeek: number | null;
  title?: string;
  pointsRule?: string;
  basePath?: string;
  statPrimaryLabel?: string;
  /** @deprecated use statPrimaryLabel */
  uniqueParadas?: number;
}

export function GlobalHero({
  weekNow,
  weekRangeNow,
  songsCount,
  olderWeek,
  newerWeek,
  title = "Global 100",
  pointsRule,
  basePath = "/global/100",
  statPrimaryLabel,
  uniqueParadas,
}: GlobalHeroProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslations();
  const rule = pointsRule ?? t("global.pointsRule");
  const primaryStat =
    statPrimaryLabel ??
    (uniqueParadas != null ? t("global.chartsCount", { count: uniqueParadas }) : t("global.songsCount", { count: songsCount }));

  return (
    <div style={{
      background: "linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 100%)",
      borderRadius: isMobile ? 16 : 20,
      padding: isMobile ? "24px 20px" : "48px 48px",
      marginBottom: 48,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? 20 : 40,
      alignItems: isMobile ? "flex-start" : "center",
      color: "white",
    }}>
      <div style={{
        width: isMobile ? 72 : 140,
        height: isMobile ? 72 : 140,
        borderRadius: isMobile ? 16 : 20,
        flexShrink: 0,
        background: "radial-gradient(circle at 30% 30%, #FA243C, #FF5858)",
        boxShadow: "0 16px 40px rgba(250,36,60,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg
          width={isMobile ? 32 : 64}
          height={isMobile ? 32 : 64}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>
          {weekNow}
        </div>
        <div style={{ fontSize: isMobile ? 40 : 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 10 }}>
          {title}
        </div>
        <p style={{ fontSize: isMobile ? 13 : 15, opacity: 0.8, maxWidth: 480, lineHeight: 1.6, marginBottom: 14 }}>
          {rule}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 6 : 20, fontSize: isMobile ? 12 : 14, opacity: 0.7, marginBottom: 14 }}>
          <span>{primaryStat}</span>
          <span style={{ display: isMobile ? "none" : "inline" }}>·</span>
          <span>{t("global.songsCount", { count: songsCount })}</span>
          <span style={{ display: isMobile ? "none" : "inline" }}>·</span>
          <span>{weekRangeNow}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {olderWeek ? (
            <Link
              href={`${basePath}?week=${olderWeek}`}
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "white", padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 10, textDecoration: "none", fontSize: isMobile ? 12 : 13, fontWeight: 600 }}
            >
              {t("global.prevWeek")}
            </Link>
          ) : (
            <span style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 10, fontSize: isMobile ? 12 : 13, fontWeight: 600 }}>
              {t("global.prevWeek")}
            </span>
          )}
          {newerWeek ? (
            <Link
              href={`${basePath}?week=${newerWeek}`}
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "white", padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 10, textDecoration: "none", fontSize: isMobile ? 12 : 13, fontWeight: 600 }}
            >
              {t("global.nextWeek")}
            </Link>
          ) : (
            <span style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 10, fontSize: isMobile ? 12 : 13, fontWeight: 600 }}>
              {t("global.nextWeek")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
