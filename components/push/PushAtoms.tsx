"use client";

import { Music } from "lucide-react";
import type { ParticipantData } from "./push-types";
import { PODIUM_COLORS } from "./push-helpers";

export function CheckIcon({ color = "white", size = 10 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ParticipantAvatar({ p, size = 30 }: { p: ParticipantData; size?: number }) {
  const label = (p.name ?? p.handle ?? "?")[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: p.avatarColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontSize: Math.floor(size * 0.4), fontWeight: 700,
    }}>
      {label}
    </div>
  );
}

export function TrackCover({ imageUrl, size = 40 }: { imageUrl: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <img src={imageUrl} alt="" width={size} height={size}
        style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, background: "var(--fill-subtle)",
      display: "grid", placeItems: "center", flexShrink: 0,
    }}>
      <Music size={size * 0.4} color="var(--text-muted)" />
    </div>
  );
}

export function RankBadge({ pos, small, isDragging }: { pos: number; small?: boolean; isDragging?: boolean }) {
  const sz = small ? 22 : 26;
  const r = small ? 5 : 7;
  const bg = isDragging ? "var(--accent)" : pos <= 3 ? PODIUM_COLORS[pos - 1] : "var(--fill-subtle)";
  const color = isDragging || pos <= 3 ? "white" : "var(--text-muted)";
  return (
    <div style={{
      width: sz, height: sz, borderRadius: r,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: small ? 10 : 11, fontWeight: 800, background: bg, color, flexShrink: 0,
    }}>
      {pos}
    </div>
  );
}
