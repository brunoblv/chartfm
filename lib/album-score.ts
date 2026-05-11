export function scoreColor(score: number): string {
  if (score >= 75) return "#1B873F";
  if (score >= 50) return "#E09F00";
  return "#C5291C";
}

export function scoreBg(score: number): string {
  if (score >= 75) return "#E8F8EE";
  if (score >= 50) return "#FFF8E1";
  return "#FDECEC";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Aclamado";
  if (score >= 75) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 50) return "Misto";
  if (score >= 40) return "Regular";
  return "Fraco";
}

export function buildScoreDistribution(ratings: number[]): number[] {
  const dist = new Array(10).fill(0);
  for (const r of ratings) {
    const bucket = Math.min(9, Math.floor(r / 10));
    dist[bucket]++;
  }
  return dist;
}
