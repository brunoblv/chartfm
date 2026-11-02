/**
 * Critérios de maturidade de conteúdo: decidem se uma página pode ser indexada
 * e se pode receber AdSense. A política do AdSense proíbe anúncios em telas sem
 * conteúdo próprio (catálogo automático, fichas sem contribuição), então o mesmo
 * critério serve aos dois — página fraca não indexa nem monetiza.
 *
 * Não existe mínimo oficial; os limiares abaixo exigem contribuição comunitária
 * real (vários usuários, histórico no Global, avaliações com texto).
 */

export const QUALITY_THRESHOLDS = {
  song: { minUniqueUsers: 5, minWeeksTop100: 1 },
  album: { minRatings: 3, minTextReviews: 1, minUniqueUsers: 10, minWeeksTop100: 2 },
  artist: { minUniqueUsers: 10, minSongsCharted: 3, minTextReviews: 2 },
  profile: { minPublishedCharts: 4 },
  chart: { minEntries: 10 },
  /** Diretório de reviews: fração mínima dos itens visíveis com avaliação. */
  reviewDirectory: { minReviewedShare: 0.6, minReviewedItems: 8 },
} as const;

export type SongQualityInput = { uniqueUsers: number; weeksTop100: number };

export function isSongMature(s: SongQualityInput): boolean {
  const t = QUALITY_THRESHOLDS.song;
  return s.uniqueUsers >= t.minUniqueUsers && s.weeksTop100 >= t.minWeeksTop100;
}

export type AlbumQualityInput = {
  ratingsCount: number;
  textReviewsCount: number;
  uniqueUsers: number;
  weeksTop100: number;
};

export function isAlbumMature(a: AlbumQualityInput): boolean {
  const t = QUALITY_THRESHOLDS.album;
  const hasReviews = a.ratingsCount >= t.minRatings && a.textReviewsCount >= t.minTextReviews;
  const hasChartHistory = a.uniqueUsers >= t.minUniqueUsers && a.weeksTop100 >= t.minWeeksTop100;
  return hasReviews || hasChartHistory;
}

export type ArtistQualityInput = {
  uniqueUsers: number;
  songsCharted: number;
  textReviewsCount: number;
};

export function isArtistMature(a: ArtistQualityInput): boolean {
  const t = QUALITY_THRESHOLDS.artist;
  const hasChartHistory = a.uniqueUsers >= t.minUniqueUsers && a.songsCharted >= t.minSongsCharted;
  return hasChartHistory || a.textReviewsCount >= t.minTextReviews;
}

export function isProfileMature(p: { publishedCharts: number }): boolean {
  return p.publishedCharts >= QUALITY_THRESHOLDS.profile.minPublishedCharts;
}

export function isChartMature(c: { entryCount: number }): boolean {
  return c.entryCount >= QUALITY_THRESHOLDS.chart.minEntries;
}

/** Listagens (CriticsFM): só monetiza se a tela visível for dominada por itens avaliados. */
export function isReviewDirectoryMature(items: { reviewCount: number }[]): boolean {
  const t = QUALITY_THRESHOLDS.reviewDirectory;
  if (items.length === 0) return false;
  const reviewed = items.filter((i) => i.reviewCount > 0).length;
  return reviewed >= t.minReviewedItems && reviewed / items.length >= t.minReviewedShare;
}

/** Metadata `robots` coerente com a maturidade. */
export function robotsForMaturity(mature: boolean): { index: boolean; follow: boolean } {
  return { index: mature, follow: true };
}

/**
 * Linguagem de consenso ("Aclamação universal") só com amostra suficiente.
 * Abaixo disso a interface mostra a nota com o tamanho da amostra, sem rótulo.
 */
export const MIN_RATINGS_FOR_CONSENSUS_LABEL = 5;

export function canShowConsensusLabel(ratingsCount: number): boolean {
  return ratingsCount >= MIN_RATINGS_FOR_CONSENSUS_LABEL;
}
