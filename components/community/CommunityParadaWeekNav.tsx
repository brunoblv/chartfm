"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";

type WeekNavTarget = { weekIndex: number; weekLabel: string };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function navBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1px solid var(--divider)",
    background: enabled ? "var(--surface)" : "var(--fill-subtle)",
    color: enabled ? "var(--text)" : "var(--text-disabled)",
    cursor: enabled ? "pointer" : "not-allowed",
    flexShrink: 0,
    padding: 0,
    boxShadow: enabled ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  };
}

export function CommunityParadaWeekNav({
  basePath,
  previousWeek,
  nextWeek,
}: {
  basePath: string;
  previousWeek: WeekNavTarget | null;
  nextWeek: WeekNavTarget | null;
}) {
  const router = useRouter();
  const isMobile = useIsMobile(641);
  const { t } = useTranslations();

  const goToWeek = useCallback(
    (weekIndex: number) => {
      router.push(`${basePath}?week=${weekIndex}`);
    },
    [basePath, router],
  );

  const goToPrevious = useCallback(() => {
    if (previousWeek) goToWeek(previousWeek.weekIndex);
  }, [previousWeek, goToWeek]);

  const goToNext = useCallback(() => {
    if (nextWeek) goToWeek(nextWeek.weekIndex);
  }, [nextWeek, goToWeek]);

  useEffect(() => {
    if (!previousWeek && !nextWeek) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && previousWeek) {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight" && nextWeek) {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousWeek, nextWeek, goToPrevious, goToNext]);

  if (!previousWeek && !nextWeek) return null;

  return (
    <div
      role="toolbar"
      aria-label={t("chart.navAria")}
      style={{
        position: "fixed",
        bottom: isMobile ? "calc(68px + env(safe-area-inset-bottom, 0px))" : 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 6 : 10,
        padding: isMobile ? "6px 8px" : "8px 12px",
        borderRadius: 100,
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: "1px solid var(--divider)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        maxWidth: isMobile ? "calc(100vw - 24px)" : 420,
      }}
    >
      <button
        type="button"
        onClick={goToPrevious}
        disabled={!previousWeek}
        aria-label={
          previousWeek
            ? t("chart.navPrev", { label: previousWeek.weekLabel })
            : t("chart.navNoPrev")
        }
        style={navBtnStyle(!!previousWeek)}
      >
        <ChevronLeft size={20} />
      </button>

      <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 4px" }}>
        {previousWeek && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            ← {previousWeek.weekLabel}
          </div>
        )}
        {!isMobile && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-disabled)",
              marginTop: previousWeek || nextWeek ? 2 : 0,
            }}
          >
            {t("chart.navKeyboard")}
          </div>
        )}
        {nextWeek && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
          >
            {nextWeek.weekLabel} →
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={goToNext}
        disabled={!nextWeek}
        aria-label={
          nextWeek ? t("chart.navNext", { label: nextWeek.weekLabel }) : t("chart.navNoNext")
        }
        style={navBtnStyle(!!nextWeek)}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
