"use client";

import { useState, useEffect, useCallback } from "react";
import type { RoundData } from "./push-types";

export const SPOTIFY_PATH =
  "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

export const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

export const STAGES = ["Inscrição", "Revelação", "Escuta & Avaliação", "Resultado"] as const;

export const PHASE_TO_STAGE: Record<RoundData["phase"], number> = {
  SUBMISSION: 0,
  LISTENING: 2,
  RANKING: 2,
  RESULT: 3,
};

export function isListenAndRankPhase(phase: RoundData["phase"]) {
  return phase === "LISTENING" || phase === "RANKING";
}

export function phaseLabel(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "Inscrição";
  if (isListenAndRankPhase(phase)) return "Escuta & Avaliação";
  return "Resultado";
}

export function phaseColor(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "var(--accent)";
  if (isListenAndRankPhase(phase)) return "#6366f1";
  return "#10b981";
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatReleaseDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const m = months[d.getMonth()];
  return `${m[0].toUpperCase() + m.slice(1)} ${d.getFullYear()}`;
}

export { pushPoints } from "@/lib/push-scoring";

export function useTimeRemaining(endIso: string | null): string {
  const compute = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "Encerrado";
    const totalMins = Math.floor(diff / 60000);
    const totalHours = Math.floor(totalMins / 60);
    if (totalHours >= 48) return `${Math.floor(totalHours / 24)}d restantes`;
    if (totalHours >= 1) return `${totalHours}h ${totalMins % 60}m restantes`;
    return `${totalMins}m restantes`;
  }, []);

  const [remaining, setRemaining] = useState(() => compute(endIso));

  useEffect(() => {
    setRemaining(compute(endIso));
    if (!endIso) return;
    const t = setInterval(() => setRemaining(compute(endIso)), 60000);
    return () => clearInterval(t);
  }, [endIso, compute]);

  return remaining;
}
