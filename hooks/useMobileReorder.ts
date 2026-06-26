"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DEFAULT_MOBILE_REORDER_MODE,
  MOBILE_REORDER_MODE_META,
  moveItemDown,
  moveItemToIndex,
  moveItemUp,
  readMobileReorderMode,
  swapItemsAt,
  writeMobileReorderMode,
  type MobileReorderMode,
} from "@/lib/mobile-reorder";

type UseMobileReorderOptions<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  getItemLabel?: (item: T, index: number) => string;
};

export function useMobileReorder<T>({
  items,
  onChange,
  getItemLabel = (item) => String(item),
}: UseMobileReorderOptions<T>) {
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

  const resetInteraction = useCallback(() => {
    setSelectedIndex(null);
    setEditTargetIndex(null);
  }, []);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      onChange(moveItemUp(items, index));
    },
    [items, onChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;
      onChange(moveItemDown(items, index));
    },
    [items, onChange],
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
        onChange(swapItemsAt(items, selectedIndex, index));
        setSelectedIndex(null);
        return;
      }
      if (mode === "position") {
        setEditTargetIndex((current) => (current === index ? null : index));
      }
    },
    [items, mode, onChange, selectedIndex],
  );

  const handleMoveToPosition = useCallback(
    (targetIndex: number) => {
      if (editTargetIndex === null) return;
      onChange(moveItemToIndex(items, editTargetIndex, targetIndex));
      setEditTargetIndex(null);
    },
    [editTargetIndex, items, onChange],
  );

  const selectedTitle =
    selectedIndex !== null && items[selectedIndex] != null
      ? getItemLabel(items[selectedIndex], selectedIndex)
      : null;

  const editTargetTitle =
    editTargetIndex !== null && items[editTargetIndex] != null
      ? getItemLabel(items[editTargetIndex], editTargetIndex)
      : null;

  const modeMeta = MOBILE_REORDER_MODE_META[mode];

  const hint = useMemo(
    () => modeMeta.hint({ selectedTitle }),
    [modeMeta, selectedTitle],
  );

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
        borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
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
        canMoveDown: index < items.length - 1,
        onMoveUp: () => handleMoveUp(index),
        onMoveDown: () => handleMoveDown(index),
      };
    },
    [editTargetIndex, handleMoveDown, handleMoveUp, handleRowTap, items.length, mode, selectedIndex],
  );

  const positionButtons = useMemo(
    () =>
      items.map((_, i) => ({
        position: i + 1,
        isCurrent: editTargetIndex === i,
        onSelect: () => handleMoveToPosition(i),
      })),
    [editTargetIndex, handleMoveToPosition, items],
  );

  return {
    mode,
    setMode,
    hint,
    modeLabel: modeMeta.label,
    modeDescription: modeMeta.description,
    selectedIndex,
    selectedTitle,
    editTargetIndex,
    editTargetTitle,
    cancelSelection: () => setSelectedIndex(null),
    closePositionSheet: () => setEditTargetIndex(null),
    resetInteraction,
    getRowProps,
    positionButtons,
    showSwapBanner: mode === "swap" && selectedIndex !== null,
    showPositionSheet: mode === "position" && editTargetIndex !== null,
  };
}
