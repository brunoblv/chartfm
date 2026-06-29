"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { buildWeekLabelFromDate } from "@/lib/chart-week";
import { useTranslations } from "@/hooks/useTranslations";

export function YourWeekCard({
  streak,
  daysLeft,
  paradaNome,
  primaryParadaId,
  thisWeekChartId,
}: {
  streak: number;
  daysLeft: number;
  paradaNome: string | null;
  primaryParadaId: string | null;
  thisWeekChartId: string | null;
}) {
  const { t } = useTranslations();
  const weekNow = buildWeekLabelFromDate(new Date());
  const hasSubmitted = thisWeekChartId !== null;
  const label = paradaNome ? paradaNome.toUpperCase() : t("home.yourChart");

  const daysLabel =
    daysLeft === 0
      ? t("home.lastDay")
      : daysLeft === 1
        ? t("home.daysLeft", { count: daysLeft })
        : t("home.daysLeftPlural", { count: daysLeft });

  return (
    <div
      style={{
        background: "var(--gradient-hero)",
        borderRadius: 18,
        padding: 24,
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: 20,
        boxShadow: "var(--shadow-hero)",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "rgba(255,255,255,0.15)",
          display: "grid",
          placeItems: "center",
          backdropFilter: "blur(10px)",
          flexShrink: 0,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
          {label} · {weekNow}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 2, lineHeight: 1.2 }}>
          {hasSubmitted ? t("home.publishedThisWeek") : t("home.promptWeek")}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {hasSubmitted ? (
            t("home.clickToView")
          ) : (
            <>
              {daysLabel}
              {streak > 0 && (
                <>
                  {" · "}
                  {t("home.activeStreak")} <Flame size={12} fill="white" />
                </>
              )}
            </>
          )}
        </div>
      </div>
      <Link
        href={
          hasSubmitted
            ? `/chart/${thisWeekChartId}`
            : primaryParadaId
              ? `/create?paradaId=${encodeURIComponent(primaryParadaId)}`
              : "/create"
        }
        style={{
          background: "white",
          color: "var(--accent)",
          textDecoration: "none",
          padding: "12px 22px",
          borderRadius: 100,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {hasSubmitted ? t("home.viewMyChart") : t("home.createChart")}
      </Link>
    </div>
  );
}
