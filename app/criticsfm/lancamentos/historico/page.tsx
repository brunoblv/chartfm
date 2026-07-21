import { Shell } from "@/components/layout/Shell";
import { getWeeklyReleaseHistory } from "@/lib/weekly-releases";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { LancamentosHistorico } from "./LancamentosHistorico";
import Link from "next/link";

export const revalidate = 600;

export default async function LancamentosHistoricoPage() {
  const { t } = await getServerTranslations();
  const history = await getWeeklyReleaseHistory();

  return (
    <Shell
      title={t("criticsfm.releasesHistoryTitle")}
      subtitle={t("criticsfm.pastWeeksSubtitle")}
      headerRight={
        <Link
          href="/criticsfm/lancamentos"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          {t("criticsfm.currentWeekLink")}
        </Link>
      }
    >
      <LancamentosHistorico history={history} />
    </Shell>
  );
}
