import { getServerSession } from "next-auth";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { getCriticsFMAlbums, getTopRatedAlbums } from "@/lib/criticsfm-data";
import { ClubeDoAlbum } from "./ClubeDoAlbum";
import { TopAlbumsSection } from "./TopAlbumsSection";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { ReviewsLinkButton } from "./ReviewsLinkButton";

export const revalidate = 60;

export default async function CriticsFMPage() {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const [albums, round] = await Promise.all([
    getCriticsFMAlbums(),
    getActiveClubeRound(session?.user?.id ?? null),
  ]);
  const topAlbums = getTopRatedAlbums(albums);

  return (
    <Shell
      title={t("criticsfm.title")}
      subtitle={t("criticsfm.subtitle")}
      headerRight={<ReviewsLinkButton />}
    >
      <ClubeDoAlbum round={round} />
      <TopAlbumsSection albums={topAlbums} />
    </Shell>
  );
}
