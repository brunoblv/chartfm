"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type Props = {
  title: string;
  currentPosition: number;
  maxPosition: number;
  onConfirm: (position: number) => void;
  onClose: () => void;
};

function clampPosition(value: number, max: number) {
  return Math.min(max, Math.max(1, value));
}

export function MobileReorderPositionSheet({
  title,
  currentPosition,
  maxPosition,
  onConfirm,
  onClose,
}: Props) {
  const [value, setValue] = useState(String(currentPosition));

  useEffect(() => {
    setValue(String(currentPosition));
  }, [currentPosition]);

  const numericValue = clampPosition(parseInt(value, 10) || currentPosition, maxPosition);
  const canIncrement = numericValue < maxPosition;
  const canDecrement = numericValue > 1;
  const isUnchanged = numericValue === currentPosition;

  const applyValue = (next: number) => {
    const clamped = clampPosition(next, maxPosition);
    setValue(String(clamped));
  };

  const handleConfirm = () => {
    if (isUnchanged) {
      onClose();
      return;
    }
    onConfirm(numericValue);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface-elevated)",
          borderRadius: "20px 20px 0 0",
          padding: "16px 16px 48px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "var(--divider-strong)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
        />

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              marginBottom: 3,
            }}
          >
            Mover para posição
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label
            htmlFor="mobile-reorder-position"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Posição (1–{maxPosition})
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              border: "1px solid var(--divider-strong)",
              borderRadius: 12,
              background: "var(--fill-inset)",
              overflow: "hidden",
            }}
          >
            <input
              id="mobile-reorder-position"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, String(maxPosition).length))}
              onBlur={() => applyValue(parseInt(value, 10) || currentPosition)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                padding: "14px 16px",
                fontSize: 22,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.03em",
                color: "var(--text)",
                fontFamily: "inherit",
                outline: "none",
                textAlign: "left",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid var(--divider)",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                disabled={!canIncrement}
                onClick={() => applyValue(numericValue + 1)}
                aria-label="Aumentar posição"
                style={stepButtonStyle(canIncrement)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={!canDecrement}
                onClick={() => applyValue(numericValue - 1)}
                aria-label="Diminuir posição"
                style={{
                  ...stepButtonStyle(canDecrement),
                  borderTop: "1px solid var(--divider)",
                }}
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Posição atual: {currentPosition}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "13px 16px",
              borderRadius: 12,
              border: "1px solid var(--divider-strong)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: "13px 16px",
              borderRadius: 12,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: isUnchanged ? 0.55 : 1,
            }}
          >
            {isUnchanged ? "Fechar" : "Mover"}
          </button>
        </div>
      </div>
    </div>
  );
}

function stepButtonStyle(enabled: boolean): CSSProperties {
  return {
    width: 44,
    height: 28,
    border: "none",
    background: "var(--fill-subtle)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.28,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}
