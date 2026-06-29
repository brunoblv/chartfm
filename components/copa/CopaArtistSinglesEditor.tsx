"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import {
  COPA_SINGLES_COUNT,
  SLOT_LABELS,
  getArtistUsedSongKeys,
  getLockedSlotIndexes,
  isSongUsedInLockedSlot,
  songPickKey,
  type CopaSinglesEditWindow,
  type LockedSingleSlot,
} from "@/lib/copa";
import {
  readCopaSongDrag,
  slotDropKey,
  writeCopaSongDrag,
  type CopaSongDragPayload,
} from "@/lib/copa-song-dnd";
import { CopaSinglesMobileReorder } from "@/components/copa/CopaSinglesMobileReorder";
import { useIsMobile } from "@/hooks/useIsMobile";

type SingleData = { slotIndex: number; songName: string; songId: string | null };

type SongResult = { id: string | null; title: string; artist: string };

type Props = {
  open: boolean;
  onClose: () => void;
  artistId: string;
  artistName: string;
  singles: SingleData[];
  slotLocks: LockedSingleSlot[];
  editWindow: CopaSinglesEditWindow;
  canEditSlot: (slotIndex: number) => boolean;
  search: string;
  onSearchChange: (q: string) => void;
  results: SongResult[];
  saving: boolean;
  onAssign: (slotIndex: number, songName: string, songId: string | null) => Promise<boolean>;
  onSwap: (fromSlotIndex: number, toSlotIndex: number) => Promise<boolean>;
  focusSlotIndex?: number | null;
  title?: string;
  onEditSlot?: (slotIndex: number) => void;
};

export function CopaArtistSinglesEditor({
  open,
  onClose,
  artistId,
  artistName,
  singles,
  slotLocks,
  editWindow,
  canEditSlot,
  search,
  onSearchChange,
  results,
  saving,
  onAssign,
  onSwap,
  focusSlotIndex = null,
  title = "Definir músicas",
  onEditSlot,
}: Props) {
  const [dropOver, setDropOver] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (!open) return null;

  function defaultAssignSlot() {
    if (focusSlotIndex != null && canEditSlot(focusSlotIndex)) return focusSlotIndex;
    const empty = [...Array(COPA_SINGLES_COUNT).keys()].find(
      (i) => canEditSlot(i) && singles.every((s) => s.slotIndex !== i || s.songName.startsWith("Single ")),
    );
    if (empty != null) return empty;
    return [...Array(COPA_SINGLES_COUNT).keys()].find((i) => canEditSlot(i)) ?? 0;
  }

  const lockedIndexes = getLockedSlotIndexes(slotLocks);

  function clearDrop() {
    setDropOver(null);
  }

  async function handleDropOnSlot(slotIndex: number, payload: CopaSongDragPayload) {
    if (!canEditSlot(slotIndex) || saving) return;

    if (
      payload.fromArtistId === artistId &&
      payload.fromSlotIndex != null &&
      payload.fromSlotIndex !== slotIndex
    ) {
      await onSwap(payload.fromSlotIndex, slotIndex);
      return;
    }

    await onAssign(slotIndex, payload.title, payload.songId);
  }

  function onSlotDragOver(e: React.DragEvent, slotIndex: number) {
    if (!canEditSlot(slotIndex)) return;
    e.preventDefault();
    setDropOver(slotDropKey(artistId, slotIndex));
  }

  async function onSlotDrop(e: React.DragEvent, slotIndex: number) {
    e.preventDefault();
    clearDrop();
    const payload = readCopaSongDrag(e);
    if (!payload) return;
    await handleDropOnSlot(slotIndex, payload);
  }

  function isSongUsed(title: string, songId: string | null, excludeSlot?: number) {
    if (lockedIndexes.size === 0) {
      const key = songPickKey(songId, title);
      if (!key) return false;
      return getArtistUsedSongKeys(singles, excludeSlot).has(key);
    }
    return isSongUsedInLockedSlot(singles, title, songId, lockedIndexes, excludeSlot);
  }

  function usedInLabel(title: string, songId: string | null, excludeSlot?: number) {
    const key = songPickKey(songId, title);
    if (!key) return null;
    const used = getArtistUsedSongKeys(singles, excludeSlot);
    const conflict = used.get(key);
    if (!conflict) return null;
    if (lockedIndexes.size > 0 && !lockedIndexes.has(conflict.slotIndex)) return null;
    return conflict.label;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        background: "rgba(0,0,0,.75)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--panel, var(--surface))",
          width: "100%",
          maxWidth: 560,
          maxHeight: "calc(100dvh - 32px)",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--divider)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {artistName}
              {isMobile
                ? " · use ↑↓, trocar ou posição nos slots editáveis"
                : " · arraste músicas para os slots ou entre slots editáveis"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
          <input
            autoFocus
            placeholder={`Buscar música de ${artistName}…`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              background: "var(--fill-inset)",
              border: "1.5px solid var(--divider)",
              borderRadius: 10,
              padding: "11px 14px",
              color: "var(--text)",
              fontSize: 15,
              fontWeight: 600,
              outline: "none",
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.4 }}>
            {isMobile
              ? "Busque abaixo e toque para atribuir. Troque músicas entre fases futuras com os controles."
              : "Arraste entre slots das próximas fases. Músicas de etapas já disputadas ficam bloqueadas."}
          </div>

          {search.length > 0 && !isSongUsed(search, null) && (
            <div
              draggable={!saving}
              onDragStart={(e) => writeCopaSongDrag(e, { title: search, songId: null })}
              onDragEnd={clearDrop}
              onClick={() => !saving && onAssign(defaultAssignSlot(), search, null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                cursor: saving ? "not-allowed" : "grab",
                border: "1px dashed var(--divider)",
                marginBottom: 8,
                opacity: saving ? 0.5 : 1,
              }}
            >
              <GripVertical size={16} color="var(--text-disabled)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Usar &quot;{search}&quot;</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Entrada manual · arraste para um slot</div>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {results.map((song) => {
                const taken = isSongUsed(song.title, song.id);
                const takenLabel = usedInLabel(song.title, song.id);
                return (
                  <div
                    key={song.id ?? song.title}
                    draggable={!taken && !saving}
                    onDragStart={(e) => {
                      if (taken || saving) {
                        e.preventDefault();
                        return;
                      }
                      writeCopaSongDrag(e, { title: song.title, songId: song.id });
                    }}
                    onDragEnd={clearDrop}
                    onClick={() => !taken && !saving && onAssign(defaultAssignSlot(), song.title, song.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: taken || saving ? "not-allowed" : "grab",
                      opacity: taken || saving ? 0.45 : 1,
                    }}
                  >
                    <GripVertical size={16} color="var(--text-disabled)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {song.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {taken ? `Disputada em ${takenLabel}` : song.artist}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isMobile ? (
            <CopaSinglesMobileReorder
              singles={singles}
              slotLocks={slotLocks}
              canEditSlot={canEditSlot}
              onSwap={onSwap}
              onEditSlot={onEditSlot ?? (() => {})}
              competingArtistIds={editWindow.competingArtistIds}
            />
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => {
              const single = singles.find((s) => s.slotIndex === i);
              const lock = slotLocks.find((l) => l.slotIndex === i);
              const editable = canEditSlot(i);
              const isEmpty = !single || single.songName.startsWith("Single ");
              const dropKey = slotDropKey(artistId, i);
              const highlighted = dropOver === dropKey;
              const canDrag = editable && !isEmpty && !saving;

              return (
                <div
                  key={i}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (!canDrag || !single) {
                      e.preventDefault();
                      return;
                    }
                    writeCopaSongDrag(e, {
                      title: single.songName,
                      songId: single.songId,
                      fromArtistId: artistId,
                      fromSlotIndex: i,
                    });
                  }}
                  onDragEnd={clearDrop}
                  onDragOver={(e) => onSlotDragOver(e, i)}
                  onDragLeave={() => setDropOver((prev) => (prev === dropKey ? null : prev))}
                  onDrop={(e) => onSlotDrop(e, i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${highlighted ? "var(--up-fg)" : "var(--divider)"}`,
                    background: highlighted
                      ? "var(--up-bg)"
                      : lock
                        ? "var(--fill-inset)"
                        : "var(--surface)",
                    cursor: canDrag ? "grab" : editable ? "copy" : "default",
                    opacity: editable ? 1 : 0.72,
                  }}
                >
                  {canDrag ? (
                    <GripVertical size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 14, flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      width: 18,
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-disabled)",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--text-disabled)",
                        marginBottom: 2,
                      }}
                    >
                      {SLOT_LABELS[i]}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isEmpty ? "var(--text-disabled)" : "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isEmpty ? (editable ? "Solte uma música aqui…" : "—") : single!.songName}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "3px 7px",
                      borderRadius: 99,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      flexShrink: 0,
                      background: lock
                        ? lock.status === "LIVE"
                          ? "var(--accent-tint)"
                          : "var(--fill-inset)"
                        : editable
                          ? "var(--up-bg)"
                          : "var(--fill-inset)",
                      color: lock
                        ? lock.status === "LIVE"
                          ? "var(--accent)"
                          : "var(--text-muted)"
                        : editable
                          ? "var(--up-fg)"
                          : "var(--text-muted)",
                    }}
                  >
                    {lock ? (lock.status === "LIVE" ? "Em jogo" : "Disputado") : editable ? "Editável" : editWindow.competingArtistIds?.length ? "Eliminado" : "Fechado"}
                  </span>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
