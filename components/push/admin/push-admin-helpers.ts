import type { PushPhase, RoundRow, IntegrationStatus } from "./push-admin-types";

export const PHASE_LABELS: Record<PushPhase, string> = {
  SUBMISSION: "Inscrições",
  LISTENING: "Escuta & Avaliação",
  RANKING: "Escuta & Avaliação",
  RESULT: "Resultado",
};

export const PHASE_NEXT: Partial<Record<PushPhase, string>> = {
  SUBMISSION: "Avançar para Escuta & Avaliação",
  LISTENING: "Avançar para Resultado",
  RANKING: "Avançar para Resultado",
};

export const PHASE_COLORS: Record<PushPhase, string> = {
  SUBMISSION: "var(--accent)",
  LISTENING: "#6366f1",
  RANKING: "#6366f1",
  RESULT: "#10b981",
};

export const RULES = [
  "Lançamento máximo de 12 meses (data do álbum no Spotify)",
  "Cada música só pode ser indicada uma única vez em qualquer rodada",
  "Cada membro indica exatamente 1 música por rodada",
  "Músicas ficam ocultas até o encerramento das inscrições",
  "O membro não pode avaliar a própria música indicada",
  "Qualquer membro logado pode avaliar, mesmo sem ter inscrito música",
  "Pontuação: #1 = 20 pts → último = 1 pt (decaimento geométrico)",
  "Participante que não avaliar: +20 pts de multa para cada outra música da rodada",
];

export const NAV_ITEMS = ["Rodadas", "Membros", "Regras", "Histórico"];

export function isListenAndRankPhase(phase: PushPhase) {
  return phase === "LISTENING" || phase === "RANKING";
}

export function needsPlaylistSync(round: RoundRow): boolean {
  return (
    (isListenAndRankPhase(round.phase) || round.phase === "RESULT") &&
    (!round.spotifyPlaylistId || !round.youtubePlaylistId)
  );
}

export function canRunPlaylistSync(round: RoundRow, integrations: IntegrationStatus): boolean {
  const needsSpotify = !round.spotifyPlaylistId;
  const needsYoutube = !round.youtubePlaylistId;
  if (needsSpotify && !integrations.spotifyConnected) return false;
  if (needsYoutube && !integrations.youtubeConnected) return false;
  return needsPlaylistSync(round);
}

export function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function inputToISO(local: string) {
  return new Date(local).toISOString();
}

export function formatShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
