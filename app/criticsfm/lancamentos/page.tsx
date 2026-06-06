import { Shell } from "@/components/layout/Shell";
import { getActiveWeeklyRelease } from "@/lib/weekly-releases";
import { LancamentosDaSemana } from "./LancamentosDaSemana";
import Link from "next/link";

export const revalidate = 300;

export default async function LancamentosPage() {
  const release = await getActiveWeeklyRelease();

  return (
    <Shell
      title="Lançamentos da Semana"
      subtitle="Álbuns em destaque para ouvir esta semana"
      headerRight={
        <Link
          href="/criticsfm/lancamentos/historico"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          Ver histórico →
        </Link>
      }
    >
      <LancamentosDaSemana release={release} />
    </Shell>
  );
}
