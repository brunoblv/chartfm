"use client";

import type { MobileReorderMode } from "@/lib/mobile-reorder";
import { MobileReorderRowControls } from "@/components/mobile-reorder/MobileReorderRowControls";
import type { MobileReorderRowState } from "@/components/mobile-reorder/MobileReorderListRow";

type Props = {
  slotIndex: number;
  phaseLabel: string;
  songName: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  mode?: MobileReorderMode;
  rowProps?: MobileReorderRowState;
  readonly?: boolean;
  onEdit?: () => void;
};

export function CopaSinglesMobileSlotRow({
  slotIndex,
  phaseLabel,
  songName,
  statusLabel,
  statusColor,
  statusBg,
  mode = "arrows",
  rowProps,
  readonly = false,
  onEdit,
}: Props) {
  const isEmpty = songName.startsWith("Single ");

  if (readonly || !rowProps) {
    return (
      <div
        onClick={onEdit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderTop: "1px solid var(--divider)",
          background: "var(--fill-inset)",
          opacity: 0.85,
          cursor: onEdit ? "pointer" : "default",
        }}
      >
        <span
          style={{
            width: 22,
            fontSize: 11,
            fontWeight: 800,
            color: "var(--text-disabled)",
            flexShrink: 0,
            textAlign: "center",
          }}
        >
          {slotIndex + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-disabled)", marginBottom: 2 }}>
            {phaseLabel}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isEmpty ? "—" : songName}
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, background: statusBg, color: statusColor }}>
          {statusLabel}
        </span>
      </div>
    );
  }

  const { rowStyle, onRowClick, isSelected, isSwapTarget, canMoveUp, canMoveDown, onMoveUp, onMoveDown } = rowProps;

  return (
    <div
      onClick={onRowClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderTop: "1px solid var(--divider)",
        boxSizing: "border-box",
        background: "var(--surface)",
        ...rowStyle,
      }}
    >
      <span
        style={{
          width: 22,
          fontSize: 11,
          fontWeight: 800,
          color: "var(--text-disabled)",
          flexShrink: 0,
          textAlign: "center",
        }}
      >
        {slotIndex + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-disabled)", marginBottom: 2 }}>
          {phaseLabel}
        </div>
        <div
          onClick={(e) => {
            if (onEdit) {
              e.stopPropagation();
              onEdit();
            }
          }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isEmpty ? "var(--text-disabled)" : "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isEmpty ? "Escolher música…" : songName}
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
      <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, background: statusBg, color: statusColor }}>
        {statusLabel}
      </span>
    </div>
  );
}
