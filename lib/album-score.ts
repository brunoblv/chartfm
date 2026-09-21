import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";

export type ScoreBandId = "acclaimed" | "recommended" | "mixed" | "unfavorable" | "rejected";

export type ScoreBand = {
  id: ScoreBandId;
  min: number;
  max: number;
  color: string;
  bg: string;
};

export const SCORE_BAND_LABEL_KEYS: Record<ScoreBandId, string> = {
  acclaimed: "criticsfm.bandAcclaimed",
  recommended: "criticsfm.bandRecommended",
  mixed: "criticsfm.bandMixed",
  unfavorable: "criticsfm.bandUnfavorable",
  rejected: "criticsfm.bandRejected",
};

export const SCORE_BANDS: ScoreBand[] = [
  { id: "acclaimed", min: 90, max: 100, color: "#1B873F", bg: "#E8F8EE" },
  { id: "recommended", min: 70, max: 89, color: "#34C759", bg: "#EAF9EE" },
  { id: "mixed", min: 50, max: 69, color: "#E09F00", bg: "#FFF8E1" },
  { id: "unfavorable", min: 30, max: 49, color: "#FF9500", bg: "#FFF3E0" },
  { id: "rejected", min: 0, max: 29, color: "#C5291C", bg: "#FDECEC" },
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

export function scoreBandKey(score: number): string {
  return SCORE_BAND_LABEL_KEYS[getBand(score).id];
}

export function scoreLabel(score: number, locale: Locale = "pt-BR"): string {
  return translate(locale, scoreBandKey(score));
}

/**
 * Com 1 avaliação só, um rótulo qualitativo como "Aclamação universal" sugere consenso
 * que não existe — troca por uma leitura neutra "nota/100 · 1 avaliação".
 */
export function scoreSummaryLabel(score: number, reviewCount: number, locale: Locale = "pt-BR"): string {
  if (reviewCount === 1) {
    return translate(locale, "criticsfm.singleReviewLabel", { score });
  }
  return scoreLabel(score, locale);
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
