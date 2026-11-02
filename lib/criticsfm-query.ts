import type { CriticsFMAlbum } from "@/lib/criticsfm-data";

/**
 * Filtro/ordenação/paginação do diretório CriticsFM, executados no servidor.
 * Antes o catálogo inteiro (~20 mil álbuns) era serializado no HTML inicial
 * (~6,5 MB); agora o cliente recebe só a página visível.
 */

export const CRITICSFM_SORT_IDS = ["recent", "score", "reviews"] as const;
export type CriticsFMSort = (typeof CRITICSFM_SORT_IDS)[number];

export const CRITICSFM_SCORE_FILTERS = [
  "all",
  "acclaimed",
  "recommended",
  "mixed",
  "unfavorable",
  "rejected",
  "unrated",
] as const;
export type CriticsFMScoreFilter = (typeof CRITICSFM_SCORE_FILTERS)[number];

export const CRITICSFM_PAGE_SIZE = 16;
export const CRITICSFM_MAX_LIMIT = 64;

/** Campos que a listagem realmente exibe — sem gêneros, ids extras etc. */
export type CriticsFMListItem = Pick<
  CriticsFMAlbum,
  "id" | "title" | "artist" | "albumType" | "coverUrl" | "releaseDate" | "score" | "reviewCount"
>;

export type CriticsFMQuery = {
  filter: CriticsFMScoreFilter;
  sort: CriticsFMSort;
  q: string;
  offset: number;
  limit: number;
};

export type CriticsFMPage = { items: CriticsFMListItem[]; total: number };

export function matchesScoreFilter(a: Pick<CriticsFMAlbum, "score" | "reviewCount">, f: CriticsFMScoreFilter): boolean {
  if (f === "all") return true;
  if (f === "unrated") return a.reviewCount === 0;
  if (a.reviewCount === 0) return false;
  if (f === "acclaimed") return a.score >= 90;
  if (f === "recommended") return a.score >= 70 && a.score < 90;
  if (f === "mixed") return a.score >= 50 && a.score < 70;
  if (f === "unfavorable") return a.score >= 30 && a.score < 50;
  if (f === "rejected") return a.score < 30;
  return true;
}

function toListItem(a: CriticsFMAlbum): CriticsFMListItem {
  return {
    id: a.id,
    title: a.title,
    artist: a.artist,
    albumType: a.albumType,
    coverUrl: a.coverUrl,
    releaseDate: a.releaseDate,
    score: a.score,
    reviewCount: a.reviewCount,
  };
}

export function parseCriticsFMQuery(params: URLSearchParams | Record<string, string | undefined>): CriticsFMQuery {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  const filter = (CRITICSFM_SCORE_FILTERS as readonly string[]).includes(get("filter") ?? "")
    ? (get("filter") as CriticsFMScoreFilter)
    : "all";
  const sort = (CRITICSFM_SORT_IDS as readonly string[]).includes(get("sort") ?? "")
    ? (get("sort") as CriticsFMSort)
    : "recent";
  const offset = Math.max(0, Math.floor(Number(get("offset")) || 0));
  const limit = Math.min(CRITICSFM_MAX_LIMIT, Math.max(1, Math.floor(Number(get("limit")) || CRITICSFM_PAGE_SIZE)));
  const q = (get("q") ?? "").trim().slice(0, 100);
  return { filter, sort, q, offset, limit };
}

export function queryCriticsFMAlbums(all: CriticsFMAlbum[], query: CriticsFMQuery): CriticsFMPage {
  const q = query.q.toLowerCase();
  let list = all.filter((a) => {
    if (!matchesScoreFilter(a, query.filter)) return false;
    if (q && !a.title.toLowerCase().includes(q) && !a.artist.toLowerCase().includes(q)) return false;
    return true;
  });
  if (query.sort === "score") list = [...list].sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount);
  else if (query.sort === "reviews") list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
  else list = [...list].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  return {
    total: list.length,
    items: list.slice(query.offset, query.offset + query.limit).map(toListItem),
  };
}

export function topRatedCriticsFM(all: CriticsFMAlbum[], limit = 6): CriticsFMListItem[] {
  return all
    .filter((a) => a.reviewCount >= 2)
    .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount)
    .slice(0, limit)
    .map(toListItem);
}
