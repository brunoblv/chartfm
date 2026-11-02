import { Shell } from "@/components/layout/Shell";
import { getCriticsFMCatalog } from "@/lib/criticsfm-data";
import { CRITICSFM_PAGE_SIZE, queryCriticsFMAlbums, topRatedCriticsFM } from "@/lib/criticsfm-query";
import { CriticsFMClient } from "../CriticsFMClient";

export const revalidate = 60;

export default async function CriticsFMReviewsPage() {
  const catalog = await getCriticsFMCatalog();
  // Só a primeira página vai no HTML; o restante é paginado via /api/criticsfm/albums.
  const initialPage = queryCriticsFMAlbums(catalog, {
    filter: "all",
    sort: "recent",
    q: "",
    offset: 0,
    limit: CRITICSFM_PAGE_SIZE,
  });

  return (
    <Shell title="">
      <CriticsFMClient initialPage={initialPage} topAlbums={topRatedCriticsFM(catalog)} showBreadcrumb />
    </Shell>
  );
}
