import { Shell } from "@/components/layout/Shell";
import { getWeeklyReleaseHistory } from "@/lib/weekly-releases";
import { LancamentosHistorico } from "./LancamentosHistorico";
import Link from "next/link";

export const revalidate = 600;

export default async function LancamentosHistoricoPage() {
  const history = await getWeeklyReleaseHistory();

  return (
    <Shell
      title="Histórico de Lançamentos"
      subtitle="Álbuns em destaque de semanas anteriores"
      headerRight={
        <Link
          href="/criticsfm/lancamentos"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          ← Semana atual
        </Link>
      }
    >
      <LancamentosHistorico history={history} />
    </Shell>
  );
}
