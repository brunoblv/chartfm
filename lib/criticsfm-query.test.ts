import { describe, expect, it } from "vitest";
import type { CriticsFMAlbum } from "@/lib/criticsfm-data";
import { parseCriticsFMQuery, queryCriticsFMAlbums, topRatedCriticsFM } from "@/lib/criticsfm-query";

function album(id: number, score: number, reviewCount: number, releaseDate: string): CriticsFMAlbum {
  return {
    id,
    title: `Album ${id}`,
    artist: id % 2 ? "Taylor Swift" : "Lady Gaga",
    artistId: 1,
    genres: ["pop", "dance"],
    albumType: "ALBUM",
    releaseDate,
    coverUrl: null,
    score,
    reviewCount,
  };
}

const catalog = Array.from({ length: 20_000 }, (_, i) =>
  album(i + 1, (i * 7) % 100, i % 10 === 0 ? 3 : 0, `20${String(10 + (i % 15)).padStart(2, "0")}-01-01`),
);

describe("queryCriticsFMAlbums", () => {
  it("devolve só a página pedida e o total", () => {
    const page = queryCriticsFMAlbums(catalog, parseCriticsFMQuery({}));
    expect(page.total).toBe(20_000);
    expect(page.items).toHaveLength(16);
    // payload enxuto: sem gêneros/artistId
    expect(Object.keys(page.items[0]).sort()).toEqual(
      ["albumType", "artist", "coverUrl", "id", "releaseDate", "reviewCount", "score", "title"],
    );
    expect(JSON.stringify(page).length).toBeLessThan(5_000);
  });

  it("filtra, busca e pagina", () => {
    const unrated = queryCriticsFMAlbums(catalog, parseCriticsFMQuery({ filter: "unrated", limit: "64" }));
    expect(unrated.items.every((a) => a.reviewCount === 0)).toBe(true);
    const gaga = queryCriticsFMAlbums(catalog, parseCriticsFMQuery({ q: "gaga", sort: "score", offset: "16" }));
    expect(gaga.items.every((a) => a.artist === "Lady Gaga")).toBe(true);
    expect(gaga.total).toBe(10_000);
  });

  it("limita parâmetros abusivos", () => {
    const q = parseCriticsFMQuery({ limit: "100000", offset: "-5", filter: "x", sort: "y" });
    expect(q).toMatchObject({ limit: 64, offset: 0, filter: "all", sort: "recent" });
  });

  it("top avaliados exige amostra mínima", () => {
    expect(topRatedCriticsFM(catalog).every((a) => a.reviewCount >= 2)).toBe(true);
  });
});
