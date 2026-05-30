import { Shell } from "@/components/layout/Shell";
import { getCriticsFMAlbums } from "@/lib/criticsfm-data";
import { CriticsFMClient } from "../CriticsFMClient";

export const revalidate = 60;

export default async function CriticsFMReviewsPage() {
  const albums = await getCriticsFMAlbums();

  return (
    <Shell title="">
      <CriticsFMClient albums={albums} showBreadcrumb />
    </Shell>
  );
}
