"use client";

import { MOBILE_REORDER_MODE_META, type MobileReorderMode } from "@/lib/mobile-reorder";

const MODES: MobileReorderMode[] = ["arrows", "position", "swap"];

type Props = {
  mode: MobileReorderMode;
  onModeChange: (mode: MobileReorderMode) => void;
};

export function MobileReorderModeSwitcher({ mode, onModeChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--fill-subtle)",
        borderRadius: 12,
        padding: 3,
        gap: 2,
        width: "100%",
      }}
    >
      {MODES.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 9,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 120ms",
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {MOBILE_REORDER_MODE_META[m].tab}
          </button>
        );
      })}
    </div>
  );
}
