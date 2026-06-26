"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import type { MobileReorderMode } from "@/lib/mobile-reorder";
import { MobileReorderRowControls } from "./MobileReorderRowControls";

export type MobileReorderRowState = {
  rowStyle: CSSProperties;
  onRowClick?: () => void;
  isSelected: boolean;
  isSwapTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

type Props = {
  position: number;
  cover: ReactNode;
  title: string;
  artist: string;
  mode: MobileReorderMode;
  rowProps: MobileReorderRowState;
  onRemove: () => void;
  opacity?: number;
  rowStyleOverride?: CSSProperties;
};

export function MobileReorderListRow({
  position,
  cover,
  title,
  artist,
  mode,
  rowProps,
  onRemove,
  opacity = 1,
  rowStyleOverride,
}: Props) {
  const { rowStyle, onRowClick, isSelected, isSwapTarget, canMoveUp, canMoveDown, onMoveUp, onMoveDown } =
    rowProps;

  return (
    <div
      onClick={onRowClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--divider-soft)",
        boxSizing: "border-box",
        background: "var(--surface)",
        opacity,
        ...rowStyle,
        ...rowStyleOverride,
      }}
    >
      <div
        style={{
          width: 26,
          flexShrink: 0,
          alignSelf: "flex-start",
          paddingTop: 2,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
          color: "var(--text)",
          textAlign: "left",
        }}
      >
        {position}
      </div>

      <div style={{ flexShrink: 0, lineHeight: 0 }}>{cover}</div>

      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
            marginTop: 1,
          }}
        >
          {artist}
        </div>
      </div>

      <MobileReorderRowControls
        mode={mode}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isSelected={isSelected}
        isSwapTarget={isSwapTarget}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-disabled)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 0,
          width: 32,
          height: 32,
        }}
        aria-label="Remover"
      >
        <X size={18} />
      </button>
    </div>
  );
}
