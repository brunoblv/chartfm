import { Shell } from "@/components/layout/Shell";
import { getActiveWeeklyRelease } from "@/lib/weekly-releases";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { LancamentosDaSemana } from "./LancamentosDaSemana";
import Link from "next/link";

export const revalidate = 300;

export default async function LancamentosPage() {
  const [{ t }, release] = await Promise.all([
    getServerTranslations(),
    getActiveWeeklyRelease(),
  ]);

  return (
    <Shell
      title={t("criticsfm.newAlbums")}
      subtitle={t("criticsfm.newAlbumsSubtitle")}
      headerRight={
        <Link
          href="/criticsfm/lancamentos/historico"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          {t("criticsfm.viewHistoricoLink")}
        </Link>
      }
    >
      <LancamentosDaSemana release={release} />
    </Shell>
  );
}
