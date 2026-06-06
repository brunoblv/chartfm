import { getServerSession } from "next-auth";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { getCriticsFMAlbums, getTopRatedAlbums } from "@/lib/criticsfm-data";
import { getActiveWeeklyRelease } from "@/lib/weekly-releases";
import { ClubeDoAlbum } from "./ClubeDoAlbum";
import { TopAlbumsSection } from "./TopAlbumsSection";
import { WeeklyReleaseBanner } from "./WeeklyReleaseBanner";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { ReviewsLinkButton } from "./ReviewsLinkButton";

export const revalidate = 60;

export default async function CriticsFMPage() {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const [albums, round, weeklyRelease] = await Promise.all([
    getCriticsFMAlbums(),
    getActiveClubeRound(session?.user?.id ?? null),
    getActiveWeeklyRelease(),
  ]);
  const topAlbums = getTopRatedAlbums(albums);

  return (
    <Shell
      title={t("criticsfm.title")}
      subtitle={t("criticsfm.subtitle")}
      headerRight={<ReviewsLinkButton />}
    >
      {weeklyRelease && <WeeklyReleaseBanner release={weeklyRelease} />}
      <ClubeDoAlbum round={round} />
      <TopAlbumsSection albums={topAlbums} />
    </Shell>
  );
}
