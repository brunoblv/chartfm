"use client";

import type { MobileReorderMode } from "@/lib/mobile-reorder";

type Props = {
  mode: MobileReorderMode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isSelected: boolean;
  isSwapTarget: boolean;
};

function arrowButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 26,
    borderRadius: 7,
    border: "1px solid var(--divider)",
    background: "var(--fill-inset)",
    color: "var(--text)",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.28,
    fontFamily: "inherit",
    flexShrink: 0,
  };
}

export function MobileReorderRowControls({
  mode,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isSelected,
  isSwapTarget,
}: Props) {
  if (mode === "arrows") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveUp) onMoveUp();
          }}
          style={arrowButtonStyle(canMoveUp)}
          aria-label="Mover para cima"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveDown) onMoveDown();
          }}
          style={arrowButtonStyle(canMoveDown)}
          aria-label="Mover para baixo"
        >
          ↓
        </button>
      </div>
    );
  }

  if (mode === "position") {
    return (
      <div
        style={{
          fontSize: 20,
          color: "var(--text-muted)",
          flexShrink: 0,
          lineHeight: 1,
          alignSelf: "center",
        }}
        aria-hidden
      >
        ›
      </div>
    );
  }

  if (isSelected) {
    return (
      <div
        style={{
          background: "var(--accent)",
          color: "white",
          fontSize: 10,
          fontWeight: 700,
          padding: "4px 10px",
          borderRadius: 100,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        ✓ Selecionada
      </div>
    );
  }

  if (isSwapTarget) {
    return (
      <div
        style={{
          background: "var(--fill-subtle)",
          color: "var(--text-muted)",
          fontSize: 10,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 100,
          flexShrink: 0,
          border: "1px dashed var(--divider-strong)",
          whiteSpace: "nowrap",
        }}
      >
        Trocar aqui
      </div>
    );
  }

  return null;
}
