"use client";

import { useTranslations } from "@/hooks/useTranslations";

interface MovementBadgeProps {
  status: "new" | "return" | "up" | "down" | "same";
  delta?: number | null;
  compact?: boolean;
}

export function MovementBadge({ status, delta, compact = false }: MovementBadgeProps) {
  const { t } = useTranslations();

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: compact ? 10 : 11,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    padding: compact ? "1px 5px" : "2px 7px",
    borderRadius: 6,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const sz = compact ? 9 : 10;

  if (status === "new") {
    return (
      <span
        style={{ ...base, background: "#000", color: "#fff" }}
        aria-label={t("chart.movementNew")}
      >
        {t("chart.movementNewBadge")}
      </span>
    );
  }
  if (status === "return") {
    return (
      <span
        style={{ ...base, background: "#111827", color: "#FFFFFF" }}
        aria-label={t("chart.movementReturn")}
      >
        {t("chart.movementReturnBadge")}
      </span>
    );
  }
  if (status === "same") {
    return (
      <span
        style={{ ...base, background: "#F2F2F7", color: "#6B6B70" }}
        aria-label={t("chart.movementSteadyAria")}
      >
        ―
      </span>
    );
  }
  if (status === "up") {
    return (
      <span
        style={{ ...base, background: "#E8F8EE", color: "#1B873F" }}
        aria-label={t("chart.movementUpAria", { delta: delta ?? 0 })}
      >
        <svg width={sz} height={sz} viewBox="0 0 10 10">
          <path d="M5 1 L9 8 L1 8 Z" fill="currentColor" />
        </svg>
        {delta}
      </span>
    );
  }
  if (status === "down") {
    return (
      <span
        style={{ ...base, background: "#FDECEC", color: "#C5291C" }}
        aria-label={t("chart.movementDownAria", {
          delta: Math.abs(delta ?? 0),
        })}
      >
        <svg width={sz} height={sz} viewBox="0 0 10 10">
          <path d="M5 9 L1 2 L9 2 Z" fill="currentColor" />
        </svg>
        {Math.abs(delta ?? 0)}
      </span>
    );
  }
  return null;
}
