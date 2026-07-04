"use client";

import { useEffect, useState } from "react";
import { GripVertical, Plus } from "lucide-react";
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
import { COPA_SONG_SEARCH_MIN_CHARS } from "@/lib/copa-song-search-client";
import { useIsMobile } from "@/hooks/useIsMobile";

type SingleData = { slotIndex: number; songName: string; songId: string | null };

type SongResult = { id: string | null; title: string; artist: string; spotifyId?: string | null };

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
  onAssign: (slotIndex: number, songName: string, songId: string | null, spotifySongId?: string | null) => Promise<boolean>;
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
  // O slot que abriu o editor recebe o primeiro + (semântica de substituir);
  // os + seguintes vão para o próximo slot vazio.
  const [focusConsumed, setFocusConsumed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setFocusConsumed(false);
  }, [focusSlotIndex]);

  if (!open) return null;

  function defaultAssignSlot() {
    const isEmptySlot = (i: number) =>
      singles.every((s) => s.slotIndex !== i || s.songName.startsWith("Single "));
    if (
      focusSlotIndex != null &&
      canEditSlot(focusSlotIndex) &&
      (!focusConsumed || isEmptySlot(focusSlotIndex))
    ) {
      return focusSlotIndex;
    }
    const empty = [...Array(COPA_SINGLES_COUNT).keys()].find((i) => canEditSlot(i) && isEmptySlot(i));
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

    await onAssign(slotIndex, payload.title, payload.songId, payload.spotifyId);
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

  const searchInput = (
    <input
      autoFocus={!isMobile}
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
  );

  // No mobile a edição é por slot: o modal busca música só para o slot que o
  // abriu e fecha ao escolher. A ordenação fica nos controles da lista de slots.
  const mobileSlot =
    isMobile && focusSlotIndex != null && canEditSlot(focusSlotIndex) ? focusSlotIndex : null;
  const mobileSlotLabel = mobileSlot != null ? SLOT_LABELS[mobileSlot] ?? `Fase ${mobileSlot + 1}` : null;

  const searchHint = (
    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.4 }}>
      {isMobile
        ? `Toque no + para definir a música${mobileSlotLabel ? ` de ${mobileSlotLabel}` : ""}.`
        : "Toque no + para adicionar ao próximo slot livre, ou arraste direto para um slot."}
    </div>
  );

  const searchTooShort = search.trim().length > 0 && search.trim().length < COPA_SONG_SEARCH_MIN_CHARS;
  const emptyState =
    search.trim().length > 0 && results.length === 0 ? (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 4px", marginBottom: 8 }}>
        {searchTooShort
          ? `Digite pelo menos ${COPA_SONG_SEARCH_MIN_CHARS} letras para buscar.`
          : "Nenhuma música encontrada no catálogo ou no Spotify."}
      </div>
    ) : null;

  const resultsList = results.length > 0 && (
    <div style={{ marginBottom: isMobile ? 14 : 0 }}>
      {results.map((song) => {
        const taken = isSongUsed(song.title, song.id);
        const takenLabel = usedInLabel(song.title, song.id);
        const disabled = taken || saving;
        return (
          <div
            key={song.spotifyId ?? song.id ?? song.title}
            draggable={!disabled && !isMobile}
            onDragStart={(e) => {
              if (disabled || isMobile) {
                e.preventDefault();
                return;
              }
              writeCopaSongDrag(e, { title: song.title, songId: song.id, spotifyId: song.spotifyId ?? null });
            }}
            onDragEnd={clearDrop}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 4px 10px 8px",
              borderRadius: 10,
              cursor: disabled ? "default" : isMobile ? "default" : "grab",
              opacity: disabled && !taken ? 0.45 : 1,
            }}
          >
            {!isMobile && (
              <GripVertical size={16} color="var(--text-disabled)" style={{ flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: taken ? "var(--text-muted)" : "var(--text)",
                }}
              >
                {song.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {taken ? `Disputada em ${takenLabel}` : song.artist}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (disabled) return;
                const slot = mobileSlot ?? defaultAssignSlot();
                if (slot === focusSlotIndex) setFocusConsumed(true);
                const ok = await onAssign(slot, song.title, song.id, song.spotifyId ?? null);
                if (ok && isMobile) onClose();
              }}
              disabled={disabled}
              aria-label={taken ? "Música já usada" : `Adicionar ${song.title}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: taken ? "var(--up-bg)" : "var(--accent)",
                color: taken ? "var(--up-fg)" : "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                flexShrink: 0,
                opacity: saving && !taken ? 0.5 : 1,
              }}
            >
              {taken ? "✓" : <Plus size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );

  const slotsList = isMobile ? (
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
  );

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
          maxWidth: isMobile ? 560 : 900,
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
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {mobileSlotLabel ? `Música para ${mobileSlotLabel}` : title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {artistName}
              {isMobile
                ? " · a busca fecha ao escolher"
                : " · adicione com o + ou arraste músicas para os slots"}
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

        {isMobile ? (
          <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
            {searchInput}
            {searchHint}
            {emptyState}
            {resultsList}
            {/* Sem slot focado (fallback), mostra a lista para o usuário se situar */}
            {mobileSlot == null && slotsList}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            {/* Coluna de busca: resultados ao lado dos slots, sem empurrar a lista */}
            <div
              style={{
                width: 340,
                flexShrink: 0,
                borderRight: "1px solid var(--divider)",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <div style={{ padding: "14px 16px 0 20px", flexShrink: 0 }}>
                {searchInput}
                {searchHint}
                {emptyState}
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 14px 20px" }}>
                {resultsList}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", minHeight: 0 }}>
              {slotsList}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
