export type ScoreBand = {
  min: number;
  max: number;
  label: string;
  color: string;
  bg: string;
};

export const SCORE_BANDS: ScoreBand[] = [
  { min: 90, max: 100, label: "Aclamação universal", color: "#1B873F", bg: "#E8F8EE" },
  { min: 70, max: 89, label: "Muito recomendado", color: "#34C759", bg: "#EAF9EE" },
  { min: 50, max: 69, label: "Recepção mista", color: "#E09F00", bg: "#FFF8E1" },
  { min: 30, max: 49, label: "Geralmente desfavorável", color: "#FF9500", bg: "#FFF3E0" },
  { min: 0, max: 29, label: "Repúdio generalizado", color: "#C5291C", bg: "#FDECEC" },
];

function getBand(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min && score <= b.max) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export function scoreColor(score: number): string {
  return getBand(score).color;
}

export function scoreBg(score: number): string {
  return getBand(score).bg;
}

export function scoreLabel(score: number): string {
  return getBand(score).label;
}

/** Cores mais vibrantes para badges em imagens geradas (story, gerador admin). */
export function scoreBadgeColor(score: number): string {
  if (score >= 90) return "#2EB550";
  if (score >= 70) return "#5BD16A";
  if (score >= 50) return "#FFC542";
  if (score >= 30) return "#FF9500";
  return "#FF6B5C";
}

export function buildScoreDistribution(ratings: number[]): number[] {
  const dist = new Array(10).fill(0);
  for (const r of ratings) {
    const bucket = Math.min(9, Math.floor(r / 10));
    dist[bucket]++;
  }
  return dist;
}

export function formatScoreRange(band: ScoreBand): string {
  return `${band.min}–${band.max}`;
}
