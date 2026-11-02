import { describe, expect, it } from "vitest";
import {
  canShowConsensusLabel,
  isAlbumMature,
  isArtistMature,
  isReviewDirectoryMature,
  isSongMature,
  robotsForMaturity,
} from "@/lib/content-quality";

describe("content-quality", () => {
  it("música com histórico comunitário é madura; ficha sem uso não", () => {
    // Ain't In LA: 73 usuários, 13 semanas no Top 100
    expect(isSongMature({ uniqueUsers: 73, weeksTop100: 13 })).toBe(true);
    expect(isSongMature({ uniqueUsers: 3, weeksTop100: 0 })).toBe(false);
  });

  it("álbum de uma faixa, 3 ouvintes e sem semanas no Global não monetiza", () => {
    // A Different Kind of Happiness
    expect(isAlbumMature({ ratingsCount: 0, textReviewsCount: 0, uniqueUsers: 3, weeksTop100: 0 })).toBe(false);
    // Born This Way: 39 ouvintes, 7 avaliações
    expect(isAlbumMature({ ratingsCount: 7, textReviewsCount: 2, uniqueUsers: 39, weeksTop100: 5 })).toBe(true);
  });

  it("artista com várias músicas chartadas é maduro", () => {
    expect(isArtistMature({ uniqueUsers: 200, songsCharted: 351, textReviewsCount: 4 })).toBe(true);
    expect(isArtistMature({ uniqueUsers: 1, songsCharted: 1, textReviewsCount: 0 })).toBe(false);
  });

  it("diretório com 15 de 16 itens sem nota não monetiza", () => {
    const items = Array.from({ length: 16 }, (_, i) => ({ reviewCount: i === 0 ? 3 : 0 }));
    expect(isReviewDirectoryMature(items)).toBe(false);
    expect(isReviewDirectoryMature(items.map(() => ({ reviewCount: 2 })))).toBe(true);
    expect(isReviewDirectoryMature([])).toBe(false);
  });

  it("robots e rótulo de consenso", () => {
    expect(robotsForMaturity(false)).toEqual({ index: false, follow: true });
    expect(robotsForMaturity(true)).toEqual({ index: true, follow: true });
    expect(canShowConsensusLabel(3)).toBe(false);
    expect(canShowConsensusLabel(12)).toBe(true);
  });
});
