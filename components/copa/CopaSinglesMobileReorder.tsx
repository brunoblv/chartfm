"use client";

import { useMemo } from "react";
import {
  COPA_SINGLES_COUNT,
  SLOT_LABELS,
  type LockedSingleSlot,
} from "@/lib/copa";
import { useCopaSinglesMobileReorder } from "@/hooks/useCopaSinglesMobileReorder";
import {
  MobileReorderPositionSheet,
  MobileReorderToolbar,
} from "@/components/mobile-reorder";
import { CopaSinglesMobileSlotRow } from "./CopaSinglesMobileSlotRow";

type SingleData = { slotIndex: number; songName: string; songId: string | null };

type Props = {
  singles: SingleData[];
  slotLocks: LockedSingleSlot[];
  canEditSlot: (slotIndex: number) => boolean;
  onSwap: (fromSlotIndex: number, toSlotIndex: number) => void;
  onEditSlot: (slotIndex: number) => void;
  competingArtistIds?: string[];
};

function slotStatus(
  slotIndex: number,
  lock: LockedSingleSlot | undefined,
  canEdit: boolean,
  hasCompetingFilter: boolean,
) {
  if (lock) {
    return {
      label: lock.status === "LIVE" ? "Em jogo" : "Disputado",
      color: lock.status === "LIVE" ? "#FA243C" : "var(--text-muted)",
      bg: lock.status === "LIVE" ? "rgba(250,36,60,.12)" : "var(--fill-inset)",
    };
  }
  if (canEdit) {
    return { label: "Editável", color: "#34C759", bg: "rgba(52,199,89,.1)" };
  }
  if (hasCompetingFilter) {
    return { label: "Eliminado", color: "var(--text-disabled)", bg: "var(--fill-inset)" };
  }
  return { label: "Fechado", color: "var(--text-disabled)", bg: "var(--fill-inset)" };
}

export function CopaSinglesMobileReorder({
  singles,
  slotLocks,
  canEditSlot,
  onSwap,
  onEditSlot,
  competingArtistIds,
}: Props) {
  const pick = (slotIndex: number) =>
    singles.find((s) => s.slotIndex === slotIndex) ?? {
      slotIndex,
      songName: `Single ${slotIndex + 1}`,
      songId: null,
    };

  const editableRows = useMemo(
    () =>
      Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => i)
        .filter(canEditSlot)
        .map((slotIndex) => {
          const s = pick(slotIndex);
          return { slotIndex, songName: s.songName, songId: s.songId };
        }),
    [singles, canEditSlot],
  );

  const mobileReorder = useCopaSinglesMobileReorder({
    rows: editableRows,
    onSwap,
    getItemLabel: (row) => (row.songName.startsWith("Single ") ? SLOT_LABELS[row.slotIndex] : row.songName),
  });

  const editableIndexBySlot = useMemo(() => {
    const map = new Map<number, number>();
    editableRows.forEach((r, i) => map.set(r.slotIndex, i));
    return map;
  }, [editableRows]);

  const hasCompetingFilter = (competingArtistIds?.length ?? 0) > 0;

  return (
    <div style={{ position: "relative" }}>
      {mobileReorder.showToolbar && (
        <MobileReorderToolbar
          mode={mobileReorder.mode}
          onModeChange={mobileReorder.setMode}
          hint={mobileReorder.hint}
          showSwapBanner={mobileReorder.showSwapBanner}
          swapBannerTitle={mobileReorder.selectedTitle ?? undefined}
          onCancelSwap={mobileReorder.cancelSelection}
        />
      )}

      {Array.from({ length: COPA_SINGLES_COUNT }, (_, slotIndex) => {
        const single = pick(slotIndex);
        const lock = slotLocks.find((l) => l.slotIndex === slotIndex);
        const canEdit = canEditSlot(slotIndex);
        const status = slotStatus(slotIndex, lock, canEdit, hasCompetingFilter);
        const listIndex = editableIndexBySlot.get(slotIndex);

        if (canEdit && listIndex != null) {
          return (
            <CopaSinglesMobileSlotRow
              key={slotIndex}
              slotIndex={slotIndex}
              phaseLabel={SLOT_LABELS[slotIndex]}
              songName={single.songName}
              statusLabel={status.label}
              statusColor={status.color}
              statusBg={status.bg}
              mode={mobileReorder.mode}
              rowProps={mobileReorder.getRowProps(listIndex)}
              onEdit={() => onEditSlot(slotIndex)}
            />
          );
        }

        return (
          <CopaSinglesMobileSlotRow
            key={slotIndex}
            slotIndex={slotIndex}
            phaseLabel={SLOT_LABELS[slotIndex]}
            songName={single.songName}
            statusLabel={status.label}
            statusColor={status.color}
            statusBg={status.bg}
            readonly
            onEdit={canEdit ? () => onEditSlot(slotIndex) : undefined}
          />
        );
      })}

      {mobileReorder.showPositionSheet && mobileReorder.editTargetTitle ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <MobileReorderPositionSheet
            title={mobileReorder.editTargetTitle}
            currentPosition={(mobileReorder.editTargetIndex ?? 0) + 1}
            maxPosition={mobileReorder.itemCount}
            onConfirm={mobileReorder.confirmPosition}
            onClose={mobileReorder.closePositionSheet}
          />
        </div>
      ) : null}
    </div>
  );
}
