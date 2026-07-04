import type { DragEvent } from "react";

export const COPA_SONG_DRAG_MIME = "application/x-chartify-copa-song";

export type CopaSongDragPayload = {
  title: string;
  songId: string | null;
  spotifyId?: string | null;
  fromArtistId?: string;
  fromSlotIndex?: number;
};

export function writeCopaSongDrag(e: DragEvent, data: CopaSongDragPayload) {
  e.dataTransfer.setData(COPA_SONG_DRAG_MIME, JSON.stringify(data));
  e.dataTransfer.effectAllowed = "move";
}

export function readCopaSongDrag(e: DragEvent): CopaSongDragPayload | null {
  const raw = e.dataTransfer.getData(COPA_SONG_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CopaSongDragPayload;
    if (!parsed.title?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function slotDropKey(artistId: string, slotIndex: number) {
  return `${artistId}:${slotIndex}`;
}
