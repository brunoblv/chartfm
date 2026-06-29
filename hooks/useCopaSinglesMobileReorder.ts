"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DEFAULT_MOBILE_REORDER_MODE,
  MOBILE_REORDER_MODE_META,
  readMobileReorderMode,
  writeMobileReorderMode,
  type MobileReorderMode,
} from "@/lib/mobile-reorder";

export type CopaEditableSingleRow = {
  slotIndex: number;
  songName: string;
  songId: string | null;
};

type Options = {
  rows: CopaEditableSingleRow[];
  /** Troca músicas entre dois slots (fases fixas). */
  onSwap: (fromSlotIndex: number, toSlotIndex: number) => void;
  getItemLabel?: (row: CopaEditableSingleRow) => string;
};

/**
 * Reordenação mobile para Copa: slots têm fase fixa — só troca (swap), nunca desloca.
 */
export function useCopaSinglesMobileReorder({
  rows,
  onSwap,
  getItemLabel = (row) => row.songName,
}: Options) {
  const [mode, setModeState] = useState<MobileReorderMode>(DEFAULT_MOBILE_REORDER_MODE);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editTargetIndex, setEditTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    setModeState(readMobileReorderMode());
  }, []);

  const setMode = useCallback((next: MobileReorderMode) => {
    setModeState(next);
    writeMobileReorderMode(next);
    setSelectedIndex(null);
    setEditTargetIndex(null);
  }, []);

  const applySwap = useCallback(
    (listIndexA: number, listIndexB: number) => {
      if (listIndexA === listIndexB) return;
      const a = rows[listIndexA];
      const b = rows[listIndexB];
      if (!a || !b) return;
      onSwap(a.slotIndex, b.slotIndex);
    },
    [onSwap, rows],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      applySwap(index, index - 1);
    },
    [applySwap],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= rows.length - 1) return;
      applySwap(index, index + 1);
    },
    [applySwap, rows.length],
  );

  const handleRowTap = useCallback(
    (index: number) => {
      if (mode === "swap") {
        if (selectedIndex === null) {
          setSelectedIndex(index);
          return;
        }
        if (selectedIndex === index) {
          setSelectedIndex(null);
          return;
        }
        applySwap(selectedIndex, index);
        setSelectedIndex(null);
        return;
      }
      if (mode === "position") {
        setEditTargetIndex((current) => (current === index ? null : index));
      }
    },
    [applySwap, mode, selectedIndex],
  );

  const confirmPosition = useCallback(
    (position: number) => {
      if (editTargetIndex === null) return;
      const targetIndex = position - 1;
      if (targetIndex < 0 || targetIndex >= rows.length) return;
      applySwap(editTargetIndex, targetIndex);
      setEditTargetIndex(null);
    },
    [applySwap, editTargetIndex, rows.length],
  );

  const selectedTitle =
    selectedIndex !== null && rows[selectedIndex] != null
      ? getItemLabel(rows[selectedIndex])
      : null;

  const editTargetTitle =
    editTargetIndex !== null && rows[editTargetIndex] != null
      ? getItemLabel(rows[editTargetIndex])
      : null;

  const modeMeta = MOBILE_REORDER_MODE_META[mode];

  const hint = useMemo(() => {
    if (mode === "swap" && selectedTitle) {
      return `"${selectedTitle}" selecionada — toque no slot de destino`;
    }
    if (mode === "swap") return "Toque em uma música para selecionar, depois toque no destino";
    if (mode === "position") return "Toque em uma música e escolha com qual fase trocar";
    return "Toque ↑ ou ↓ para trocar com a fase vizinha";
  }, [mode, selectedTitle]);

  const getRowProps = useCallback(
    (index: number) => {
      const isSelected = mode === "swap" && selectedIndex === index;
      const isSwapTarget = mode === "swap" && selectedIndex !== null && selectedIndex !== index;
      const isEditing = mode === "position" && editTargetIndex === index;

      const rowStyle: CSSProperties = {
        cursor: mode !== "arrows" ? "pointer" : "default",
        background: isSelected
          ? "var(--accent-tint)"
          : isEditing
            ? "var(--fill-subtle)"
            : isSwapTarget
              ? "var(--fill-inset)"
              : undefined,
        boxShadow: isSelected ? "inset 3px 0 0 var(--accent)" : undefined,
        transition: "background 150ms",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      };

      return {
        rowStyle,
        onRowClick: mode !== "arrows" ? () => handleRowTap(index) : undefined,
        isSelected,
        isSwapTarget,
        isEditing,
        canMoveUp: index > 0,
        canMoveDown: index < rows.length - 1,
        onMoveUp: () => handleMoveUp(index),
        onMoveDown: () => handleMoveDown(index),
      };
    },
    [editTargetIndex, handleMoveDown, handleMoveUp, handleRowTap, mode, rows.length, selectedIndex],
  );

  return {
    mode,
    setMode,
    hint,
    selectedIndex,
    selectedTitle,
    editTargetIndex,
    editTargetTitle,
    itemCount: rows.length,
    cancelSelection: () => setSelectedIndex(null),
    closePositionSheet: () => setEditTargetIndex(null),
    confirmPosition,
    getRowProps,
    showSwapBanner: mode === "swap" && selectedIndex !== null,
    showPositionSheet: mode === "position" && editTargetIndex !== null,
    showToolbar: rows.length >= 2,
  };
}
